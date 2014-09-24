var _ = require('underscore');

function ObjectFetcher(user) {
    var that = this;
    this.user = user;
    this.fetched = null;
    this.fetchPhotosTaggedIn = function(maxToFetch) {
        var url = 'https://graph.facebook.com/v2.1/me/photos?';
        return that.initializeFetched().then( function () {
            return that.fetchFromUrl(url, maxToFetch, "Photo", 0, 0);
        });
    }
    this.fetchPhotosTaken = function(maxToFetch) {
        var url = 'https://graph.facebook.com/v2.1/me/photos/uploaded?';
        return that.initializeFetched().then( function () {
            return that.fetchFromUrl(url, maxToFetch, "Photo", 0, 0);
        });
    }
    this.fetchFeed = function(maxToFetch) {
        var url = 'https://graph.facebook.com/v2.1/me/feed?';
        return that.initializeFetched().then( function () {
            return that.fetchFromUrl(url, maxToFetch, "Feed", 0, 0);
        });
    }
    this.fetchHome = function(maxToFetch) {
        var url = 'https://graph.facebook.com/v2.1/me/home?';
        return that.initializeFetched().then( function () {
            return that.fetchFromUrl(url, maxToFetch, "Feed", 0, 0);
        });
    }
    this.fetchEvents = function(maxToFetch) {
        var url = 'https://graph.facebook.com/v2.1/me/events?';
        return that.initializeFetched().then( function () {
            return that.fetchFromUrl(url, maxToFetch, "Event", 0, 0).then(function () { return that.fetchEventsDetail() });
        });
    }
    this.fetchEventsDetail = function() {
        var Event = Parse.Object.extend("Event");
        var query = new Parse.Query(Event);
        query.equalTo("user", that.user);
        return query.find().then(function (events) {
            console.log("Getting attending/details for "+events.length+ " events");
            var promises = [];
            _.each(events, function(event) {
                promises.push(that.fetchEventDetail(event));
                promises.push(that.fetchEventAttending(event));
            })
            return Parse.Promise.when(promises).then(function() {
                return Parse.Object.saveAll(events);
            });
        });
    }
    this.fetchEventAttending = function(event) {
        var url = 'https://graph.facebook.com/v2.1/'+event.get("data").id+'/attending?&access_token=' + that.user.getFbAccessToken();
        var args = {
            url: url,
            method: 'GET'
        };
        return Parse.Cloud.httpRequest(args).then(function (httpResponse) {
            if (!httpResponse.data.data) {
                console.log("unable to fetch invite data for event.id = " +event.get("data").id);
            }
            event.set("attending", httpResponse.data.data);
            return Parse.Promise.as();
        });
    }
    this.fetchEventDetail = function(event) {
        var url = 'https://graph.facebook.com/v2.1/'+event.get("data").id+'?&access_token=' + that.user.getFbAccessToken();
        var args = {
            url: url,
            method: 'GET'
        };
        return Parse.Cloud.httpRequest(args).then(function (httpResponse) {
            event.set("detailedData", httpResponse.data);
            return Parse.Promise.as();
        });
    }
    this.fetchFromUrl = function(url, maxToFetch, type, fetched, added) {
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
                    return that.fetched.save().then(function() {
                        return Parse.Promise.as(fetched, added);
                    });
                }
                if (!httpResponse.data.paging || !httpResponse.data.paging.next) {
                    console.log("Fetched " + fetched + ". Added " + added + ". No more paging data. Exiting");
                    return that.fetched.save().then(function() {
                        return Parse.Promise.as(fetched, added);
                    });
                }
                var next = httpResponse.data.paging.next;
                console.log("Fetched " + fetched + " " + type + ". Added " + added + ". Fetching more");
                return that.fetchFromUrl(next, maxToFetch, type, fetched, added);
            });
        });
    }

    this.saveObjects = function(objects, type) {
        var dbObjects = [];
        _.each(objects, function(object) {
            if (!_.contains(that.getFetchedIds(type), object.id)) {
                dbObjects.push(that.buildObject(object, type));
                that.getFetchedIds(type).push(object.id);
            }
        });
        return Parse.Object.saveAll(dbObjects)
            .then(function() {
                return Parse.Promise.as(dbObjects.length);
            });
    }

    this.initializeFetched = function() {
        if (that.fetched) {
            return Parse.Promise.as();
        }
        var Fetched = Parse.Object.extend("Fetched");
        var query = new Parse.Query(Fetched);
        query.equalTo("user", that.user);
        return query.first().then(function (fetched) {
            if (!fetched) {
                fetched = new Fetched();
                fetched.set("user",that.user);
                fetched.set("photoIds",[]);
                fetched.set("feedIds",[]);
                fetched.set("eventIds",[]);
            }
            that.fetched = fetched;
            return Parse.Promise.as();
        });
    }

    this.getFetchedIds = function(type) {
        if (type == "Photo") {
            return that.fetched.get("photoIds");
        } else if (type == "Feed") {
            return that.fetched.get("feedIds");
        } else if (type == "Event") {
            return that.fetched.get("eventIds");
        } else {
            console.error("Unknown type: " + type);
            return null;
        }
    }

    this.buildObject = function(object, type) {
        if (type == 'Photo') {
            return that.buildPhoto(object);
        } else if (type == 'Feed') {
            return that.buildFeed(object);
        } else if (type == 'Event') {
            return that.buildEvent(object);
        } else {
            console.log("unknown object type '"+type+"'");
            return null;
        }
    }
    this.buildPhoto = function(photo) {
        var Photo = Parse.Object.extend("Photo");
        var photoDB = new Photo();
        photoDB.set("data", photo);
        photoDB.set("fbId", parseInt(photo.id));
        photoDB.set("creatorFbId", parseInt(photo.from.id));
        photoDB.set("user", that.user);
        return photoDB;
    }
    this.buildFeed = function(feed) {
        var Feed = Parse.Object.extend("Feed");
        var feedDB = new Feed();
        feedDB.set("data", feed);
        feedDB.set("fbId", feed.id);
        feedDB.set("creatorFbId", parseInt(feed.from.id));
        feedDB.set("type", feed.type);
        feedDB.set("status_type", feed.status_type);
        feedDB.set("user", that.user);
        return feedDB;
    }
    this.buildEvent = function(event) {
        var Event = Parse.Object.extend("Event");
        var eventDB = new Event();
        eventDB.set("data", event);
        eventDB.set("fbId", event.id);
        eventDB.set("user", that.user);
        return eventDB;
    }
}

exports.ObjectFetcher = ObjectFetcher;