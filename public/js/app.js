var myPlannerApp = angular.module('myPlannerApp', ['ngRoute', 'myPlannerAppControllers', 'parse-angular', 'parse-angular.enhance']);

myPlannerApp.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.
      when('/list', {
        templateUrl: 'partials/list.html',
        controller: 'ListCtrl'
      }).
      otherwise({
        redirectTo: '/list'
      });
  }]);
