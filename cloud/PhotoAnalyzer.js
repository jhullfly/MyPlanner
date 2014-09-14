var _ = require('underscore');

function PhotoAnalyzer(user) {
    this.user = user;
    this.friendRelations = {};
    this.analyze = function() {
        var that = this;
        var Photo = Parse.Object.extend("Photo");
        var query = new Parse.Query(Photo);
        query.equalTo("user", that.user);
        query.notEqualTo("analyzed", true);
        query.ascending("createdAt");
        query.limit(1000);
        return query.find().then( function (photos) {
            console.log("Analyzing " + photos.length);
            var promises = [];
            _.each(photos, function(photo) {
                promises.push(that.analyzePhoto(photo));
            });
            return Parse.Promise.when(promises);
        }).then( function() {
            console.log("Analyzed " + arguments.length);
            if (arguments.length != 0) {
                // did something so get some more.
                return that.analyze();
            }
            console.log("Saving");
            return that.saveRelations();
        });
    }
    this.saveRelations = function() {
        var that = this;
        var promises = [];
        for(friendFbId in that.friendRelations) {
            promises.push(that.getDbFriendRelation(friendFbId, that.friendRelations[friendFbId].name).then(function (relation, friendFbId2) {
                relation.set("inPhoto", that.friendRelations[friendFbId2].inPhoto+relation.get("inPhoto"));
                relation.set("photoTaken", that.friendRelations[friendFbId2].photoTaken+relation.get("photoTaken"));
                relation.set("tookPhoto", that.friendRelations[friendFbId2].tookPhoto+relation.get("tookPhoto"));
                return relation.save();
            }));
        }
        return Parse.Promise.when(promises);
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
                relation.set("inPhoto", 0);
                relation.set("photoTaken", 0);
                relation.set("tookPhoto", 0);
            }
            return Parse.Promise.as(relation, friendFbId);
        });
    }

    this.dumpRelation = function(msg, relation) {
        console.log(msg + " " + relation.get("userFbId") + " " + relation.get("friendFbId") + " " + relation.get("friendName") +
            " " + relation.get("inPhoto")+ " " + relation.get("photoTaken")+ " " + relation.get("tookPhoto"));
    }

    this.analyzePhoto = function(photo) {
        var that = this;
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
        photo.set("analyzed", true);
        return photo.save();
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
                id : person.id,
                name : person.name,
                inPhoto : 0,
                photoTaken : 0,
                tookPhoto : 0
            }
        }
        that.friendRelations[person.id][relation]++;
    }
}

exports.PhotoAnalyzer = PhotoAnalyzer;