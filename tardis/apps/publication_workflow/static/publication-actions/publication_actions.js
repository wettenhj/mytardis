/**
 * Publication Actions controller
 *
 * Provides methods to perform actions on a single publication record
 * (create, resume, share, delete etc.)
 *
 * @param {!ngDialog} ngDialog The ngDialog module
 * @param {!angular.$http} $http The Angular http service.
 * @param {!angular.$log} $log The Angular log service.
 * @param {!angular.$window} $window The Angular window service.
 * @constructor
 */
angular
.module('MyTardis')
.controller('PublicationActionsController', function ($resource, $log, ngDialog, $http, $window, $mdDialog) {
    
    var vm = this;  // view model

    vm.isPublicationResource = $resource(
        '/apps/publication-workflow/experiment/:experiment_id/is_publication/',
        {}, { 'get': { method: 'GET' } });
    vm.isPublicationDraftResource = $resource(
        '/apps/publication-workflow/experiment/:experiment_id/is_publication_draft/',
        {}, { 'get': { method: 'GET' } });

    /*
     * Initialize vm.isPublication
     */
    vm.setIsPublication = function(experimentId) {
        vm.isPublication = null;
        if (experimentId) {
            vm.isPublicationResource
                .get({'experiment_id': experimentId})
                .$promise.then(
                    function (data) {
                        vm.isPublication = angular.fromJson(data).is_publication;
                    },
                    function (error) {
                        $log.error(error);
                    }
                );
        }
    };

    /*
     * Initialize vm.isPublicationDraft
     */
    vm.setIsPublicationDraft = function(experimentId) {
        vm.isPublicationDraft = null;
        if (experimentId) {
            vm.isPublicationDraftResource
                .get({'experiment_id': experimentId})
                .$promise.then(
                    function (data) {
                        vm.isPublicationDraft = angular.fromJson(data).is_publication_draft;
                    },
                    function (error) {
                        $log.error(error);
                    }
                );
        }
    };


    /**
     * Used with ng-init:
     */
    vm.init = function(experimentId) {
        vm.experimentId = experimentId;
        vm.setIsPublication(vm.experimentId);
        vm.setIsPublicationDraft(vm.experimentId);
    };

    /**
     * Opens the publication form modal dialog
     */
    vm.openPublicationForm = function () {
        $log.debug("PublicationActionsController.openPublicationForm: vm.formData.publicationId: " + vm.formData.publicationId);
        $log.debug("PublicationActionsController.openPublicationForm: vm.formData.publicationTitle: " + vm.formData.publicationTitle);
        if (angular.isDefined(vm.formData.publicationId)) {
            vm.currentPageIdx = 1;
        }
        ngDialog.open({
            template: '/apps/publication-workflow/form/',
            data: {
                'experimentId': parseInt(vm.experimentId),
                'isPublication': vm.isPublication,
                'isPublicationDraft': vm.isPublicationDraft,
                // 'formData': JSON.parse(JSON.stringify(formData)), // deep clone
                'formData': vm.formData,
                'currentPageIdx': vm.currentPageIdx
            },
            closeByDocument: false,
            preCloseCallback: function (publicationId) {
                if (angular.isDefined(publicationId) &&
                    angular.isNumber(publicationId) &&
                    publicationId !== vm.experimentId) {
                    var redirectTo = '/experiment/view/' + publicationId + '/';
                    $window.location = redirectTo;
                } else if (angular.isDefined(publicationId)) {
                    $window.location.reload();
                }
            }
        });
    };

    /**
     * Initialize default data for the publication form
     *
     */
    vm.emptyFormData = function() {
        var formData = {};
        formData.addedDatasets = []; // List of selected datasets
        formData.publicationTitle = ""; // Initialise publication title
        formData.publicationDescription = ""; // Initialise publication description
        formData.extraInfo = {}; // Stores discipline specific metadata
        formData.authors = [
            {
                'name': '',
                'institution':'',
                'email':''
            }
        ];
        formData.acknowledgements = ""; // Acknowledgements stored here
        formData.action = ""; // specifies what action is required on form update
        // if (useFigshare) {
          // vm.formData.selectedFigshareCategories = [];
          // vm.formData.selectedFigshareKeywords = [];
        // }
        return formData;
    };
    vm.formData = vm.emptyFormData();
    vm.currentPageIdx = 0;


    /**
     * Opens the publication form modal dialog to create a new publication
     *
     */
    vm.createPublication = function () {
        vm.openPublicationForm();
    };

    /**
     * Opens the publication form modal dialog to resume editing a publication
     *
     */
    vm.resumePublication = function () {
        $log.debug("resumePublication: experimentId: " + vm.experimentId);
        var formData = vm.emptyFormData();
        formData.publicationId = vm.experimentId;
        $log.debug("resumePublication: formData.publicationId: " + formData.publicationId);
        formData.action = "resume";
        $http.post('/apps/publication-workflow/form/', formData).then(function (response) {
            $log.debug("resumePublication.http.post.success: response.data.publicationId: " + response.data.publicationId);
            $log.debug("resumePublication.http.post.success: response.data.publicationTitle: " + response.data.publicationTitle);
            vm.formData = response.data;
            if (angular.isString(vm.formData.embargo)) {
                vm.formData.embargo = new Date(vm.formData.embargo);
            }
            vm.openPublicationForm();
        },
        function () {
            vm.errorMessages = ['Could not load publication draft!'];
        });
    };

    /**
     * Create a token and open tokens dialog
     *
     * POST to /experiment/view/100/create_token/ for experiment ID 100 to create a token
     * It looks like you need to include the experiment ID in the post data, even though
     * it's already in the URL!
     * $http.post('/experiment/view/' + experiment_id + '/create_token/',
     *              {experiment_id: experiment_id})
     *      .success(function (data) {
     *          $log.debug("Created token successfully.");
     *      })
     *      .error(function(data) {
     *          $log.debug("Failed to create token.");
     *      });
     */
    vm.sharePublication = function () {
        ngDialog.open({
            template: '/apps/publication-workflow/tokens/',
            data: {
                'publicationId': parseInt(vm.experimentId)
            },
            closeByDocument: false,
        });
    };

    /*
     * Delete publication draft
     */
    vm.deletePublicationDraft = function () {
        var confirmation = $mdDialog.confirm()
            .title('Are you sure you want to delete Publication ID ' + vm.experimentId + '?')
            .textContent('You cannot undo this action!')
            .ok('Yes, delete it!')
            .cancel('No, keep it.');
  
        $mdDialog.show(confirmation).then(function() {
            $log.info('OK, deleting publication...');
            $http.post('/apps/publication-workflow/publication/delete/' + vm.experimentId + '/', {})
               .then(function (response) {
                   $log.debug("Publication deleted successfully.");
                   $window.location.reload();
               },
               function(response) {
                   $log.debug("Failed to delete publication.");
               });
        }, function() {
            $log.info('OK, keeping publication');
        });
    };
    /*
     * Mint DOI
     */
    vm.mintDOI = function () {
        var confirmation = $mdDialog.confirm()
            .title('Are you sure you want to mint a DOI for Publication ID ' + vm.experimentId + '?')
            .textContent('You cannot undo this action!')
            .ok('Yes, mint a DOI!')
            .cancel('No, don\'t mint a DOI.');
  
        $mdDialog.show(confirmation).then(function() {
            $log.info('OK, minting a DOI...');
            $log.info('Checking whether approval is required...');
            $http.post('/apps/publication-workflow/publication/mint_doi/' + vm.experimentId + '/', {})
               .then(function (response) {
                   $log.debug("DOI minted successfully.");
                   $window.location.reload();
               },
               function(response) {
                   $log.debug("Failed to mint DOI.");
               });
        }, function() {
            $log.info('OK, not minting a DOI');
        });
    };
});