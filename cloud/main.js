var _ = require('underscore');
var PF = require('cloud/PhotoFetcher.js');
var PA = require('cloud/PhotoAnalyzer.js');
function getStandardErrorFunction(status) {
    return function(object, error) {
        if (error) {
            status.error(error);
        } else if (object && object.text) {
            status.error(object.text.substring(0,1000));
        } else {
            status.error(JSON.stringify(object).substring(0,1000));
        }
    };
}

function extendUser() {
    return Parse.User.extend({
        getFbId: function () {
            return parseInt(this.get("authData").facebook.id);
        },
        getFbAccessToken: function () {
            return this.get("authData").facebook.access_token;
        }
    });
}

Parse.Cloud.define("CallBackgroundJob", function(request, response) {
    Parse.Cloud.useMasterKey();
    var jobName = request.params.jobName;
    Parse.Cloud.httpRequest({
        url: 'https://api.parse.com/1/jobs/'+jobName,
        method: 'POST',
        body: request.params,
        headers: {
            "X-Parse-Application-Id": Parse.applicationId,
            "X-Parse-Master-Key": Parse.masterKey,
            "Content-Type": "application/json;charset=utf-8"
        },
        success: function(httpResponse) {
            response.success(httpResponse.text);
        },
        error: function(httpResponse) {
            response.error('Request failed with response code ' + httpResponse.status + ' ' + httpResponse.text);
        }
    });
});

Parse.Cloud.job("FetchAndAnalyzePhotos", function(request, status) {
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query(extendUser());
    query.get(request.params.userId).then(function(user) {
        var photoFetcher = new PF.PhotoFetcher(user, 2000);
        var photoAnalyzer = new PA.PhotoAnalyzer(user);
        return photoFetcher.fetchPhotosTaggedIn().then(function() {
            return photoFetcher.fetchPhotosTaken();
        }).then( function() {
            return photoAnalyzer.analyze();
        });
    }).then(function() {
            status.success("Worked");
        }, getStandardErrorFunction(status)
    );
});

Parse.Cloud.job("PhotoFetcher", function(request, status) {
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query(extendUser());
    query.get(request.params.userId).then(function(user) {
        var photoFetcher = new PF.PhotoFetcher(user, 2000);
        return photoFetcher.fetchPhotosTaggedIn().then(function() {
            return photoFetcher.fetchPhotosTaken();
        });
    }).then(function() {status.success("Worked");},
            getStandardErrorFunction(status)
    );
});

Parse.Cloud.job("PhotoAnalyzer", function(request, status) {
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query(extendUser());
    query.get(request.params.userId).then(function(user) {
        var photoAnalyzer = new PA.PhotoAnalyzer(user);
        return photoAnalyzer.analyze();
    }).then(function() {status.success("Worked");},
            getStandardErrorFunction(status)
    );
});

