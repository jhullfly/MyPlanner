var myPlannerApp = angular.module('myPlannerApp', ['ngRoute', 'myPlannerAppControllers', 'parse-angular', 'parse-angular.enhance']);

myPlannerApp.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.
        when('/login', {
            templateUrl: 'partials/login.html',
            controller: 'LoginCtrl'
        }).
        when('/list', {
            templateUrl: 'partials/list.html',
            controller: 'ListCtrl'
        }).
        otherwise({
            redirectTo: '/login'
        });
  }])
.run( function($rootScope, $location) {
    // register listener to watch route changes
    $rootScope.$on( "$routeChangeStart", function(event, next, prev) {
        var user = Parse.User.current();

        if (user == null ) {
            // no logged user, we should be going to #/login
            if ( next.templateUrl == "partials/login.html" ) {
                // already going to #/login, no redirect needed
            } else {
                // not going to #login, we should redirect now
                $location.path( "/login" );
            }
        } else {
            // have user, we should NOT be going to #/login
            if ( next.templateUrl == "partials/login.html" ) {
                $location.path( "/list" );
            }
        }
    });
});
