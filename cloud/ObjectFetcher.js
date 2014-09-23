var _ = require('underscore');

function ObjectFetcher(user) {
    this.user = user;
    this.fetchPhotosTaggedIn = function(maxToFetch) {
        var that = this;
        var url = 'https://graph.facebook.com/v2.1/me/photos?';
        return that.fetchFromUrl(url, maxToFetch, "Photo", 0, 0);
    }
    this.fetchPhotosTaken = function(maxToFetch) {
        var that = this;
        var url = 'https://graph.facebook.com/v2.1/me/photos/uploaded?';
        return that.fetchFromUrl(url, maxToFetch, "Photo", 0, 0);
    }
    this.fetchFeed = function(maxToFetch) {
        var that = this;
        var url = 'https://graph.facebook.com/v2.1/me/feed?';
        return that.fetchFromUrl(url, maxToFetch, "Feed", 0, 0);
    }
    this.fetchHome = function(maxToFetch) {
        var that = this;
        var url = 'https://graph.facebook.com/v2.1/me/home?';
        return that.fetchFromUrl(url, maxToFetch, "Feed", 0, 0);
    }
    this.fetchEvents = function(maxToFetch) {
        var that = this;
        var url = 'https://graph.facebook.com/v2.1/me/events?';
        return that.fetchFromUrl(url, maxToFetch, "Event", 0, 0);
    }
    this.fetchFromUrl = function(url, maxToFetch, type, fetched, added) {
        var that = this;
        url += '&limit=100&access_token=' + that.user.getFbAccessToken();
        var args = {
            url: url,
            method: 'GET'
        };
        return Parse.Cloud.httpRequest(args).then(function (httpResponse) {
            fetched += httpResponse.data.data.length;
            return that.saveObjects(httpResponse.data.data, type).then(function(newAdded) {
                added += newAdded;
                if (fetched >= maxToFetch) {
                    console.log("Fetched " + fetched + ". Added " + added + ". Hit max. Exiting");
                    return Parse.Promise.as(fetched, added);
                }
                if (!httpResponse.data.paging || !httpResponse.data.paging.next) {
                    console.log("Fetched " + fetched + ". Added " + added + ". No more paging data. Exiting");
                    return Parse.Promise.as(fetched, added);
                }
                var next = httpResponse.data.paging.next;
                console.log("Fetched " + fetched + ". Added " + added + ". Fetching more from " + next);
                return that.fetchFromUrl(next, maxToFetch, type, fetched, added);
            });
        });
    }

    this.saveObjects = function(objects, type) {
        var that = this;
        var promises = [];
        _.each(objects, function(object) {
            promises.push(that.saveObject(object, type));
        });
        return Parse.Promise.when(promises).then(function() {
            var added = _.reduce(arguments, function(memo, num) {return memo+num}, 0);
            return Parse.Promise.as(added);
        });

    }
    this.saveObject = function(object, type) {
        var that = this;
        if (type == 'Photo') {
            return that.savePhoto(object);
        } else if (type == 'Feed') {
            return that.saveFeed(object);
        } else if (type == 'Event') {
            return that.saveEvent(object);
        } else {
            return Parse.Promise.error("unknown object type '"+type+"'");
        }
    }
    this.savePhoto = function(photo) {
        var that = this;
        var Photo = Parse.Object.extend("Photo");
        var query = new Parse.Query(Photo);
        query.equalTo("fbId", parseInt(photo.id));
        query.equalTo("user", that.user);
        return query.first().then( function (foundPhotoDB) {
            if (!foundPhotoDB) {
                var photoDB = new Photo();
                photoDB.set("data", photo);
                photoDB.set("fbId", parseInt(photo.id));
                photoDB.set("creatorFbId", parseInt(photo.from.id));
                photoDB.set("user", that.user);
                return photoDB.save().then( function (photoDB) {
                    return Parse.Promise.as(1);
                });
            } else {
                return Parse.Promise.as(0);
            }
        });
    }
    this.saveFeed = function(feed) {
        var that = this;
        var Feed = Parse.Object.extend("Feed");
        var query = new Parse.Query(Feed);
        query.equalTo("fbId", feed.id);
        query.equalTo("user", that.user);
        return query.first().then( function (foundFeedDB) {
            if (!foundFeedDB) {
                var feedDB = new Feed();
                feedDB.set("data", feed);
                feedDB.set("fbId", feed.id);
                feedDB.set("creatorFbId", parseInt(feed.from.id));
                feedDB.set("type", feed.type);
                feedDB.set("status_type", feed.status_type);
                feedDB.set("user", that.user);
                return feedDB.save().then( function (feedDB) {
                    return Parse.Promise.as(1);
                });
            } else {
                return Parse.Promise.as(0);
            }
        });
    }
    this.saveEvent = function(event) {
        var that = this;
        var Event = Parse.Object.extend("Event");
        var query = new Parse.Query(Event);
        query.equalTo("fbId", event.id);
        query.equalTo("user", that.user);
        return query.first().then( function (foundEventDB) {
            if (!foundEventDB) {
                var eventDB = new Event();
                eventDB.set("data", event);
                eventDB.set("fbId", event.id);
                eventDB.set("user", that.user);
                return eventDB.save().then( function (eventDB) {
                    return Parse.Promise.as(1);
                });
            } else {
                return Parse.Promise.as(0);
            }
        });
    }
}

exports.ObjectFetcher = ObjectFetcher;