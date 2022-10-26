angular.module('myApp')

.config(function ($routeProvider) {
    $routeProvider
        .when('/', {
            templateUrl: 'app/components/main/mainView.html',
            controller: 'MainController',
            controllerAs : 'main'
        })
        .otherwise({
            redirectTo: '/'
        });
})
;