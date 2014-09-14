var myPlannerAppControllers = angular.module('myPlannerAppControllers', []);

myPlannerAppControllers.factory('ParseObjectFactory', function() {
	return {
		buildFriendRelation : function() {
			return Parse.Object.extend({
				className: "FriendRelation",
				attrs: ['friendName', 'inPhoto', 'photoTaken', 'tookPhoto']
			});
		}
	}
});

myPlannerAppControllers.controller('ListCtrl', ['$scope', 'ParseObjectFactory', function ($scope, ParseObjectFactory) {
    var FriendRelation = ParseObjectFactory.buildFriendRelation();
    $scope.columns = ['friendName', 'inPhoto', 'photoTaken', 'tookPhoto'];
    $scope.sort = {
        column: 1,
        descending: true
    };
	var query = new Parse.Query(FriendRelation);
    if ($scope.sort.descending) {
        query.descending($scope.columns[$scope.sort.column]);
    } else {
        query.ascending($scope.columns[$scope.sort.column]);
    }
	query.limit(500);
	query.find({
		success:function(results) {
			$scope.relations= results;
		},
		error:function(error) {
			console.error("Error: " + error.code + " " + error.message);
		}		
	});

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
        return relation.get($scope.columns[$scope.sort.column]);
    }
}]);
