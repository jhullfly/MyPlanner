var _ = require('underscore');

function ObjectAnalyzer(user, type) {
    var that = this;
    this.user = user;
    this.type = type;
    this.objectsAnalyzed = null;
    this.analyzedCount = 0;
    this.friendRelations = {};
    this.possibleRelations = ['inPhotoWith', 'iTookPhoto', 'theyTookPhoto',
        'attendedWith', 'iAttended', 'theyAttended',
        'iLikedPhotoIn', 'theyLikedPhotoIn', 'iLikedPhotoTook', 'theyLikedPhotoTook'];
//        'iCommentedPhotoIn', 'theyCommentedPhotoIn', 'iCommentedPhotoTook', 'theyCommentedPhotoTook'

    this.analyze = function() {
        return that.initializeObjectsAnalyzed().then(function () {
            return that.analyzeFrom(0);
        });
    }

    this.analyzeFrom = function(skip) {
        var batchSize = 1000;
        var Object = Parse.Object.extend(that.type);
        var query = new Parse.Query(Object);
        query.equalTo("user", that.user);
        query.ascending("createdAt");
        query.skip(skip);
        query.limit(batchSize);
        return query.find().then( function (objects) {
            console.log("Retrieved " + objects.length + ' ' + that.type);
            _.each(objects, function(object) {
                if (!_.contains(that.getAnalyzedIds(), object.get("data").id)) {
                    that.analyzeObject(object);
                }
            });
            if (objects.length != 0) {
                return that.analyzeFrom(skip+batchSize);
            } else {
                console.log("Saving "+that.analyzedCount + " " + that.type + " analysis");
                return that.saveRelations().then(function () {
                    return that.objectsAnalyzed.save();
                });
            }
        });
    }
    this.initializeObjectsAnalyzed = function() {
        var Analyzed = Parse.Object.extend("Analyzed");
        var query = new Parse.Query(Analyzed);
        query.equalTo("user", that.user);
        return query.first().then(function (objectsAnalyzed) {
            if (!objectsAnalyzed) {
                objectsAnalyzed = new Analyzed();
                objectsAnalyzed.set("user",that.user);
                objectsAnalyzed.set("photoIds",[]);
                objectsAnalyzed.set("feedIds",[]);
                objectsAnalyzed.set("eventIds",[]);
            }
            that.objectsAnalyzed = objectsAnalyzed;
        });
    }
    this.saveRelations = function() {
        var promises = [];
        _.each(that.friendRelations, function(friendRelation, friendFbId) {
            promises.push(that.getDbFriendRelation(friendFbId, friendRelation.name)
                    .then(function (relation) {
                        if (!(friendRelation.saveOnlyNotNew && relation.newRelation)) {
                            var data = relation.get("data");
                            _.each(that.possibleRelations, function (relationType) {
                                data[relationType] = friendRelation[relationType] + data[relationType];
                            });
                            return Parse.Promise.as(relation);
                        } else {
                            return Parse.Promise.as(null);
                        }
                    })
            );
        });
        return Parse.Promise.when(promises).then(function () {
            return Parse.Object.saveAll(arguments);
        });
    }

    this.getDbFriendRelation = function(friendFbId, name) {
        var FriendRelation = Parse.Object.extend("FriendRelation");
        var query = new Parse.Query(FriendRelation);
        query.equalTo("userFbId", that.user.getFbId());
        query.equalTo("friendFbId", parseInt(friendFbId));
        return query.first().then(function (relation) {
            if (!relation) {
                relation = new FriendRelation();
                relation.set("userFbId", user.getFbId());
                relation.set("friendFbId", parseInt(friendFbId));
                relation.set("friendName", name);
                var data = {};
                _.each(that.possibleRelations, function (relationType) {
                    data[relationType]= 0;
                });
                relation.set("data", data);
                relation.newRelation = true;
            } else {
                relation.newRelation = false;
            }
            return Parse.Promise.as(relation, friendFbId);
        });
    }

    this.dumpRelation = function(msg, relation) {
        msg += " " + relation.get("userFbId") + " " + relation.get("friendFbId") +  " " + relation.get("friendName");
        _.each(that.possibleRelations, function (relationType) {
            msg += " " + relation.get("data")[relationType];
        })
        console.log(msg);
    }

    this.analyzeObject = function(object) {
        if (that.type == "Photo") {
            that.analyzePhoto(object);
        } else if (that.type == "Feed") {
            that.analyzeFeed(object);
        } else if (that.type == "Event") {
            that.analyzeEvent(object);
        } else {
            console.error("Unknown type: " + that.type);
        }
    }

    this.getAnalyzedIds = function(type) {
        type = type || that.type;
        if (that.type == "Photo") {
            return that.objectsAnalyzed.get("photoIds");
        } else if (that.type == "Feed") {
            return that.objectsAnalyzed.get("feedIds");
        } else if (that.type == "Event") {
            return that.objectsAnalyzed.get("eventIds");
        } else {
            console.error("Unknown type: " + that.type);
            return null;
        }
    }

    this.analyzeFeed = function(feed) {
        var feedData = feed.get("data");
        that.objectsAnalyzed.get("feedIds").push(feedData.id);
        that.analyzedCount++;
        var from = feedData.from;
        if (feedData.comments) {
            _.each(feedData.comments.data, function (comment) {
                if (that.user.getFbId() == parseInt(from.id)) {
                    that.addRelation(comment.from, "theyCommented");
                } else if (that.user.getFbId() == parseInt(comment.from.id)) {
                    that.addRelation(from, "iCommented");
                }
            });
        }
        if (feedData.likes) {
            _.each(feedData.likes.data, function (liker) {
                if (that.user.getFbId() == parseInt(from.id)) {
                    that.addRelation(liker, "theyLiked");
                } else if (that.user.getFbId() == parseInt(liker.id)) {
                    that.addRelation(from, "iLiked");
                }
            });
        }
        if (feedData.to && feedData.type != 'photo') {
            _.each(feedData.to.data, function (person) {
                if (that.user.getFbId() == parseInt(from.id)) {
                    that.addRelation(person, "iPosted");
                } else if (that.user.getFbId() == parseInt(person.id)) {
                    that.addRelation(from, "theyPosted");
                }
            });
        }
        if (feedData.type == 'photo') {
            if (!_.contains(that.getAnalyzedIds('Photo'), feedData.object_id)) {
                that.analyzePhotoData(feedData);
            }
        }
    }

    this.analyzeEvent = function(event) {
        var eventData = event.get("data");
        that.objectsAnalyzed.get("eventIds").push(eventData.id);
        that.analyzedCount++;
        var from = event.get("detailedData").owner;
        var attending = event.get("attending");
        var iAttended = _.some(attending, function(attendee) { return that.user.getFbId() == parseInt(attendee.id); });
        _.each(attending, function (attendee) {
            if (from && that.user.getFbId() == parseInt(from.id)) {
                //im the host
                that.addRelation(attendee, "theyAttended");
            } else if (iAttended && from.id != attendee.id) {
                //i attended and this attendee is not the host.
                // if there is not already a relation with this person ignore this.
                that.addRelation(attendee, "attendedWith", true);
            }
        });
        if (iAttended) {
            that.addRelation(from, "iAttended");
        }
    }

    this.analyzePhoto = function(photo) {
        var photoData = photo.get("data");
        that.objectsAnalyzed.get("photoIds").push(photoData.id);
        that.analyzedCount++;
        that.analyzePhotoData(photoData);
    }

    this.analyzePhotoData = function(photoData) {
        var taker = photoData.from;
        var selfie = false;
        var userInPhoto = false;
        if (photoData.tags) {
            var peopleInPhoto = photoData.tags.data;
            userInPhoto = that.inPhoto(photoData);
            var relation = userInPhoto ? 'inPhotoWith' : 'iTookPhoto';
            for (var i = 0; i < peopleInPhoto.length; i++) {
                var person = peopleInPhoto[i];
                that.addRelation(person, relation);
                if (taker.id == person.id) {
                    selfie = true;
                }
            }
            if (!selfie) {
                that.addRelation(taker, "theyTookPhoto");
            }
        }
/*        if (photoData.comments) {
            _.each(photoData.comments.data, function (comment) {
                if (that.user.getFbId() == parseInt(from.id)) {
                    that.addRelation(comment.from, "theyCommented");
                } else if (that.user.getFbId() == parseInt(comment.from.id)) {
                    that.addRelation(from, "iCommented");
                }
            });
        }
*/        if (photoData.likes) {
            _.each(photoData.likes.data, function (liker) {
                if (userInPhoto) {
                    that.addRelation(liker, "theyLikedPhotoIn");
                } else if (that.user.getFbId() == parseInt(taker.id)) {
                    that.addRelation(liker, "theyLikedPhotoTook");
                }
                if (that.user.getFbId() == parseInt(liker.id)) {
                    if (photoData.tags) {
                        _.each(photoData.tags.data, function(person) {
                            that.addRelation(person, 'iLikedPhotoIn');
                        });
                    }
                    if (!selfie) {
                        that.addRelation(taker, "iLikedPhotoTook");
                    }
                }
            });
        }
    }

    this.inPhoto = function(photoData) {
        var peopleInPhoto = photoData.tags.data;
        for(var i = 0; i < peopleInPhoto.length; i++) {
            var person = peopleInPhoto[i];
            if (parseInt(person.id) == that.user.getFbId()) {
                return true;
            }
        }
        return false;
    }
    this.addRelation = function(person, relation, saveOnlyNotNew) {
        saveOnlyNotNew = saveOnlyNotNew || false;
        //console.log("Add relation " + person.name + " " + relation + " " + saveOnlyNotNew);
        if (!person.id || parseInt(person.id) == that.user.getFbId()) {
            return;
        }
        if (!that.friendRelations[person.id]) {
            that.friendRelations[person.id] = {
                id: person.id,
                name: person.name,
                saveOnlyNotNew: saveOnlyNotNew
            }
            _.each(that.possibleRelations, function (relationType) {
                that.friendRelations[person.id][relationType] = 0;
            });
        }
        if (!saveOnlyNotNew) {
            that.friendRelations[person.id].saveOnlyNotNew = false;
        }
        that.friendRelations[person.id][relation]++;
    }
}

exports.ObjectAnalyzer = ObjectAnalyzer;