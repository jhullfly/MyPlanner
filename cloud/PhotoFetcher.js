var _ = require('underscore');

function PhotoFetcher(user, maxPhotos) {
    this.user = user;
    this.maxPhotos = maxPhotos;
    this.photosFetched = 0;
    this.photosAdded = 0;
    this.fetchPhotosTaggedIn = function() {
        var that = this;
        var url = 'https://graph.facebook.com/v2.1/me/photos?';
        return that.fetchPhotosFromUrl(url);
    }
    this.fetchPhotosTaken = function() {
        var that = this;
        var url = 'https://graph.facebook.com/v2.1/me/photos/uploaded?';
        return that.fetchPhotosFromUrl(url);
    }
    this.fetchPhotosFromUrl = function(url) {
        var that = this;
        if (that.photosFetched >= that.maxPhotos) {
            console.log("Fetched " + that.photosFetched + ". Added " + that.photosAdded + ". Hit max. Exiting");
            return Parse.Promise.as();
        }
        url += '&limit=100&access_token=' + that.user.getFbAccessToken();
        var args = {
            url: url,
            method: 'GET'
        };
        return Parse.Cloud.httpRequest(args).then(function (httpResponse) {
            that.photosFetched += httpResponse.data.data.length;
            return that.savePhotos(httpResponse.data.data, 0).then(function() {
                if (that.photosFetched >= that.maxPhotos) {
                    console.log("Fetched " + that.photosFetched + ". Added " + that.photosAdded + ". Hit max. Exiting");
                    return Parse.Promise.as();
                }
                if (!httpResponse.data.paging || !httpResponse.data.paging.next) {
                    console.log("Fetched " + that.photosFetched + ". Added " + that.photosAdded + ". No more paging data. Exiting");
                    return Parse.Promise.as();
                }
                var next = httpResponse.data.paging.next;
                console.log("Fetched " + that.photosFetched + ". Added " + that.photosAdded + ". Fetching more from " + next);
                return that.fetchPhotosFromUrl(next);
            });
        });
    }

    this.savePhotos = function(photos, start) {
        var that = this;
        if (photos.length == start) {
            return Parse.Promise.as();
        }
        var photo = photos[start];
        return that.savePhoto(photo).then(function() {
            return that.savePhotos(photos, start + 1);
        });
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
                    that.photosAdded++;
                    return Parse.Promise.as();
                });
            } else {
                return Parse.Promise.as();
            }
        });
    }
}

exports.PhotoFetcher = PhotoFetcher;