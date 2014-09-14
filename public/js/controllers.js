var myPlannerAppControllers = angular.module('myPlannerAppControllers', []);

myPlannerAppControllers.factory('ParseObjectFactory', function() {
	return {
		buildFriendRelation : function() {
			return Parse.Object.extend({
				className: "FriendRelation",
				attrs: ['friendName', 'inPhoto', 'photoTaken', 'tookPhoto'],
			});
		}
	}
});

myPlannerAppControllers.controller('ListCtrl', ['$scope', 'ParseObjectFactory', function ($scope, ParseObjectFactory) {
	var query = new Parse.Query(ParseObjectFactory.buildFriendRelation());
	query.descending("inPhoto");
	query.limit(500);
	query.find({
		success:function(results) {
			$scope.relations= results;
		},
		error:function(error) {
			console.error("Error: " + error.code + " " + error.message);
		}		
	});
}]);
