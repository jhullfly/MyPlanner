var _ = require('underscore');
var OF = require('cloud/ObjectFetcher.js');
var OA = require('cloud/ObjectAnalyzer.js');


function errorFunc(status) {
    return function(object, error) {
        console.log("Error object = "+JSON.stringify(object));
        console.log("Error error = "+JSON.stringify(error));
        if (error) {
            status.error(object.text.substring(0,1000) + error);
        } else if (object && object.text) {
            status.error(object.text.substring(0,1000));
        } else {
            status.error(JSON.stringify(object).substring(0,1000));
        }
    };
}
function successFunc(status) {
    return function() {
        console.log("worked");
        status.success("worked");
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

function doUserJob(request, status, func) {
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query(extendUser());
    query.get(request.params.userId).then(func).then(successFunc(status), errorFunc(status));
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

Parse.Cloud.job("DoEverything", function(request, status) {
    doUserJob(function(user) {
        var objectFetcher = new OF.ObjectFetcher(user);
        var photoAnalyzer = new OA.ObjectAnalyzer(user, "Photo");
        var feedAnalyzer = new OA.ObjectAnalyzer(user, "Feed");
        return objectFetcher.fetchPhotosTaggedIn(1000)
        .then(function() {
            return objectFetcher.fetchPhotosTaken(1000);
        }).then( function() {
            return photoAnalyzer.analyze();
        }).then( function() {
            return objectFetcher.fetchFeed(1000);
        }).then( function() {
            return objectFetcher.fetchHome(1000);
        }).then( function() {
            return feedAnalyzer.analyze();
        })
    });
});

Parse.Cloud.job("PhotoFetcher", function(request, status) {
    doUserJob(function(user) {
        var objectFetcher = new OF.ObjectFetcher(user);
        return objectFetcher.fetchPhotosTaggedIn(1000).then(function() {
            return objectFetcher.fetchPhotosTaken(1000);
        });
    });
});

Parse.Cloud.job("FeedFetcher", function(request, status) {
    doUserJob(function(user) {
        var objectFetcher = new OF.ObjectFetcher(user);
        return objectFetcher.fetchFeed(1000);
    });
});

Parse.Cloud.job("HomeFetcher", function(request, status) {
    doUserJob(function(user) {
        var objectFetcher = new OF.ObjectFetcher(user);
        return objectFetcher.fetchHome(1000);
    });
});

Parse.Cloud.job("PhotoAnalyzer", function(request, status) {
    doUserJob(function(user) {
        var photoAnalyzer = new OA.ObjectAnalyzer(user, "Photo");
        return photoAnalyzer.analyze();
    });
});

Parse.Cloud.job("FeedAnalyzer", function(request, status) {
    doUserJob(function(user) {
        var feedAnalyzer = new OA.ObjectAnalyzer(user, "Feed");
        return feedAnalyzer.analyze();
    });
});

Parse.Cloud.job("AllAnalyzer", function(request, status) {
    doUserJob(request, status, function(user) {
        var feedAnalyzer = new OA.ObjectAnalyzer(user, "Feed");
        var photoAnalyzer = new OA.ObjectAnalyzer(user, "Photo");
        return photoAnalyzer.analyze().then( function () {
            return feedAnalyzer.analyze();
        });
    });
});

Parse.Cloud.job("EventsFetcher", function(request, status) {
    doUserJob(request, status, function(user) {
        var objectFetcher = new OF.ObjectFetcher(user);
        return objectFetcher.fetchEvents(1000);
    });
});

