var myPlannerAppControllers = angular.module('myPlannerAppControllers', []);

function getDataColumns() {
    return ['friendName', 'inPhotoWith', 'iTookPhoto', 'theyTookPhoto',
        'attendedWith', 'iAttended', 'theyAttended',
        'iLikedPhotoIn', 'theyLikedPhotoIn', 'iLikedPhotoTook', 'theyLikedPhotoTook'];
}

myPlannerAppControllers.factory('ParseObjectFactory', function() {
	return {
		buildFriendRelation : function() {
			return Parse.Object.extend({
				className: "FriendRelation",
				attrs: ['friendName', 'data'],
                getData: function(attr) {
                    if (attr == 'friendName') {
                        return this.get('friendName');
                    } else {
                        return this.get('data')[attr];
                    }
                }
			});
		}
	}
});

myPlannerAppControllers.controller('ListCtrl', ['$scope', '$timeout', '$location', 'ParseObjectFactory',
function ($scope, $timeout, $location, ParseObjectFactory) {
    $scope.logout = function () {
        Parse.User.logOut();
        $scope.user = null;
        $location.path('/login');
    }

    $scope.fetchData = function() {
        $scope.fetchCount++;
        fetchInternal([], 0);
    }

    function fetchInternal(resultsSoFar, skip) {
        var batchSize = 10;
        var query = new Parse.Query(FriendRelation);
        query.equalTo("userFbId", parseInt(Parse.User.current().get("authData").facebook.id));
        query.limit(batchSize);
        query.skip(skip);
        query.find().then(function (results) {
            if (results.length == 0) {
                $scope.relations= resultsSoFar;
                $timeout($scope.fetchData, 10*1000);
                return Parse.Promise.as();
            } else {
                resultsSoFar = resultsSoFar.concat(results);
                skip = skip + batchSize;
                return fetchInternal(resultsSoFar, skip)
            }
        }, function(error) {
            console.error("Error: " + error.code + " " + error.message);
        });
    }

    $scope.selectedCls = function(column) {
        return column == $scope.sort.column && 'sort-' + $scope.sort.descending;
    };

    $scope.changeSorting = function(column) {
        var sort = $scope.sort;
        if (sort.column == column) {
            sort.descending = !sort.descending;
        } else {
            sort.column = column;
            sort.descending = true;
        }
    };

    $scope.orderByFunc = function(relation) {
        return relation.getData([$scope.columns[$scope.sort.column]]);
    }

    var FriendRelation = ParseObjectFactory.buildFriendRelation();
    $scope.user = Parse.User.current();
    $scope.columns = getDataColumns();
    $scope.sort = {
        column: 1,
        descending: true
    };
    $scope.fetchCount = 0;
    $scope.fetchData();

}]);


myPlannerAppControllers.controller('LoginCtrl', ['$scope', '$location', 'ParseObjectFactory',
function ($scope, $location, ParseObjectFactory) {
    $scope.loginInProgress = false;
    $scope.loginFB = function() {
        $scope.loginInProgress = true;
        Parse.FacebookUtils.logIn('user_about_me,user_actions.books,user_actions.music,user_actions.news,user_actions.video,user_activities,'+
            'user_birthday,user_education_history,user_events,user_friends,user_games_activity,user_groups,user_hometown,'+
            'user_interests,user_likes,user_location,user_photos,user_relationship_details,user_relationships,user_religion_politics,'+
            'user_status,user_tagged_places,user_videos,user_website,user_work_history,email,manage_notifications,manage_pages,publish_actions,'+
            'read_friendlists,read_insights,read_mailbox,read_page_mailboxes,read_stream,rsvp_event', {
            success: function(user) {
                console.log("User logged in through Facebook! " + JSON.stringify(user.get("authData")));
                Parse.Cloud.run("CallBackgroundJob", {
                    jobName : 'AllAnalyzer',
                    userId : user.id
                }).then(function() {
                    FB.api('/me', function (response) {
                        user.set("name", response.name);
                        user.save().then(function () {
                            $location.path('/list');
                        });
                    });
                });
            },
            error: function(user, error) {
                alert("User cancelled the Facebook login or did not fully authorize.");
            }
        });
    }
}]);
