var _ = require('underscore');

function ObjectAnalyzer(user, type) {
    this.user = user;
    this.type = type;
    this.objectsAnalyzed = null;
    this.analyzedCount = 0;
    this.friendRelations = {};
    this.possibleRelations = ['inPhoto', 'photoTaken', 'tookPhoto', 'iCommented', 'theyCommented', 'iLiked', 'theyLiked', 'iPosted', 'theyPosted'];
    this.analyze = function() {
        var that = this;
        return that.initializeObjectsAnalyzed().then(function () {
            return that.analyzeFrom(0);
        });
    }

    this.analyzeFrom = function(skip) {
        var that = this;
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
                if (!_.contains(that.getAnalyzedIds(), object.id)) {
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
        var that = this;
        var Analyzed = Parse.Object.extend("Analyzed");
        var query = new Parse.Query(Analyzed);
        query.equalTo("user", that.user);
        return query.first().then(function (objectsAnalyzed) {
            if (!objectsAnalyzed) {
                objectsAnalyzed = new Analyzed();
                objectsAnalyzed.set("user",that.user);
                objectsAnalyzed.set("photoIds",[]);
                objectsAnalyzed.set("feedIds",[]);
            }
            that.objectsAnalyzed = objectsAnalyzed;
        });
    }
    this.saveRelations = function() {
        var that = this;
        var promise = Parse.Promise.as();
        for(friendFbId in that.friendRelations) {
            promise = promise.then(function () {
                that.getDbFriendRelation(friendFbId, that.friendRelations[friendFbId].name)
                 .then(function (relation, friendFbId2) {
                    _.each(that.possibleRelations, function (relationType) {
                        relation.set(relationType, that.friendRelations[friendFbId2][relationType]+relation.get(relationType));
                    })
                    return relation.save();
            })});
        }
        return promise;
    }

    this.getDbFriendRelation = function(friendFbId, name) {
        var that = this;
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
                _.each(that.possibleRelations, function (relationType) {
                    relation.set(relationType, 0);
                });
            }
            return Parse.Promise.as(relation, friendFbId);
        });
    }

    this.dumpRelation = function(msg, relation) {
        var that = this;
        msg += " " + relation.get("userFbId") + " " + relation.get("friendFbId") +  " " + relation.get("friendName");
        _.each(that.possibleRelations, function (relationType) {
            msg += " " + relation.get(relationType);
        })
        console.log(msg);
    }

    this.analyzeObject = function(object) {
        var that = this;
        if (that.type == "Photo") {
            that.analyzePhoto(object);
        } else if (that.type == "Feed") {
            that.analyzeFeed(object);
        } else {
            console.error("Unknown type: " + that.type);
        }
    }

    this.getAnalyzedIds = function() {
        var that = this;
        if (that.type == "Photo") {
            return that.objectsAnalyzed.get("photoIds");
        } else if (that.type == "Feed") {
                return that.objectsAnalyzed.get("feedIds");
        } else {
            console.error("Unknown type: " + that.type);
            return null;
        }
    }

    this.analyzeFeed = function(feed) {
        var that = this;
        that.objectsAnalyzed.get("feedIds").push(feed.id);
        that.analyzedCount++;
        var feedData = feed.get("data");
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
    }

    this.analyzePhoto = function(photo) {
        var that = this;
        that.objectsAnalyzed.get("photoIds").push(photo.id);
        that.analyzedCount++;
        var taker = photo.get("data").from;
        var selfie = false;
        if (photo.get("data").tags) {
            var peopleInPhoto = photo.get("data").tags.data;
            var relation = that.inPhoto(photo) ? 'inPhoto' : 'photoTaken';
            for (var i = 0; i < peopleInPhoto.length; i++) {
                var person = peopleInPhoto[i];
                that.addRelation(person, relation);
                if (taker.id == person.id) {
                    selfie = true;
                }
            }
            if (!selfie) {
                that.addRelation(taker, "tookPhoto");
            }
        }
    }

    this.inPhoto = function(photo) {
        var that = this;
        var peopleInPhoto = photo.get("data").tags.data;
        for(var i = 0; i < peopleInPhoto.length; i++) {
            var person = peopleInPhoto[i];
            if (parseInt(person.id) == that.user.getFbId()) {
                return true;
            }
        }
        return false;
    }
    this.addRelation = function(person, relation) {
        var that = this;
        if (!person.id || parseInt(person.id) == that.user.getFbId()) {
            return;
        }
        if (!that.friendRelations[person.id]) {
            that.friendRelations[person.id] = {
                id: person.id,
                name: person.name
            }
            _.each(that.possibleRelations, function (relationType) {
                that.friendRelations[person.id][relationType] = 0;
            });
        }
        that.friendRelations[person.id][relation]++;
    }
}

exports.ObjectAnalyzer = ObjectAnalyzer;