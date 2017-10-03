// TODO: remove hard coded URLs in case urls.py changes

// A filter used to remove items from the list of available datasets
// when added to the list of datasets to include in the publication
angular
.module('MyTardis')
.filter('removeMatchingDatasets', function () {
    return function (input, compareTo) {
        if (angular.isUndefined(input)) {
            return input;
        }
        var output = [];
        for (var i = 0; i < input.length; i++) {
            var add = true;
            for (var j = 0; j < compareTo.length; j++) {
                if (input[i].id === compareTo[j].dataset.id) {
                    add = false;
                }
            }
            if (add) {
                output.push(input[i]);
            }
        }
        return output;
    };
});

// The following two tardisForm directives attach appropriate ng-model
// attributes to form fields
// This code was adapted from http://stackoverflow.com/questions/21943242/child-input-directive-needs-to-compile-in-the-scope-of-its-parent-for-ng-model-t
angular
.module('MyTardis')
.directive('tardisForm', function () {
    return {
        replace: true,
        transclude: true,
        scope: {
            model: '=myModel',
            schema: '='
        },
        template: '<div ng-form novalidate><div ng-transclude></div></div>',
        controller: function ($scope, $element, $attrs) {
            var vm = this;
            if (angular.isUndefined($scope.model)) {
                $scope.model = {};
            }
            $scope.model.schema = $scope.schema;
            vm.getModel = function () {
                return $attrs.myModel;
            };
        }
    };
});

angular
.module('MyTardis')
.directive('tardisFormField', function ($compile) {
    return {
        require: '^tardisForm',
        restrict: 'A',
        priority: 9999,
        terminal: true, //Pause Compilation to give us the opportunity to add our directives
        link: function postLink(scope, el, attr, parentCtrl) {
            // parentCtrl.getModel() returns the base model name in the parent
            var model = [parentCtrl.getModel(), "['" + attr.parameterName + "']"].join('');
            attr.$set('ngModel', model);
            // Resume the compilation phase after setting ngModel
            $compile(el, null /* transclude function */, 9999 /* maxPriority */)(scope);

        }
    };
});

// Publication form controller
angular
.module('MyTardis')
.controller('PublicationFormController', function ($scope, $log, $http, $document, ngDialog, $window, $timeout) {
    var vm = this;  // view model

    vm.errorMessages = []; // An array of strings to display to the user on error

    if (angular.isDefined($scope.$parent.ngDialogData)) {
        vm.isPublication = $scope.$parent.ngDialogData.isPublication;
    }
    else {
        throw new Error("isPublication is undefined in PublicationFormController");
    }
    if (angular.isDefined($scope.$parent.ngDialogData)) {
        vm.isPublicationDraft = $scope.$parent.ngDialogData.isPublicationDraft;
    }
    else {
        throw new Error("isPublicationDraft is undefined in PublicationFormController");
    }
    if (angular.isDefined($scope.$parent.ngDialogData)) {
        vm.experiment = $scope.$parent.ngDialogData.experimentId;
    }
    else {
        throw new Error("experimentId is undefined in PublicationFormController");
    }

    if (angular.isDefined($scope.$parent.ngDialogData.formData)) {
        vm.formData = $scope.$parent.ngDialogData.formData;
        if (angular.isString(vm.formData.embargo)) {
            vm.formData.embargo = new Date(vm.formData.embargo);
        }
    }
    else {
        $log.debug("PublicationFormController: Defining vm.formData from scratch.")
        vm.formData = {};
        vm.formData.addedDatasets = []; // List of selected datasets
        vm.formData.publicationTitle = ""; // Initialise publication title
        vm.formData.publicationDescription = ""; // Initialise publication description
        vm.formData.extraInfo = {}; // Stores discipline specific metadata
        vm.formData.authors = [{'name':'',
                                'institution':'',
                                'email':''}]; // Stores the authors of the publication
        vm.formData.acknowledgements = ""; // Acknowledgements stored here
        vm.formData.action = ""; // specifies what action is required on form update
    }

    // Keep track of the current page
    if (angular.isDefined($scope.$parent.ngDialogData.currentPageIdx)) {
        vm.currentPageIdx = $scope.$parent.ngDialogData.currentPageIdx;
    }
    else {
        vm.currentPageIdx = 0;
    }

    vm.exampleAcknowledgements = [{
        'agency': 'Australian Synchrotron facility',
        'text': 'This research was undertaken on the [insert beamline name] beamline at the Australian Synchrotron, Victoria, Australia.'
    },
        {
            'agency': 'Science and Industry Endowment Fund',
            'text': 'This work is supported by the Science and Industry Endowment Fund.'
        },
        {
            'agency': 'Multi-modal Australian ScienceS Imaging and Visualisation Environment',
            'text': 'This work was supported by the Multi-modal Australian ScienceS Imaging and Visualisation Environment (MASSIVE) (www.massive.org.au).'
        },
        {
            'agency': 'Australian National Beamline Facility',
            'text': 'This research was undertaken at the Australian National Beamline Facility at the Photon Factory in Japan, operated by the Australian Synchrotron.  We acknowledge the Australian Research Council for financial support and the High Energy Accelerator Research Organisation (KEK) in Tsukuba, Japan, for operations support.'
        },
        {
            'agency': 'International Synchrotron Access Program',
            'text': 'We acknowledge travel funding provided by the International Synchrotron Access Program (ISAP) managed by the Australian Synchrotron and funded by the Australian Government.'
        }];

    // Save the form state, creating a new publication if necessary
    // and call onComplete when saving is complete. The server should
    // return an experiment ID that represents the new/updated publication.
    // If this is the first time the publication has been saved, a new
    // publication will be created. Otherwise, the publication will be
    // updated.
    var saveFormState = function (onComplete, onFailure) {
        vm.loadingData = true;
        $log.debug("Saving form data. vm.formData.publicationId: " + vm.formData.publicationId);
        /* eslint-disable no-unused-vars */
        $http.post('/apps/publication-workflow/form/', vm.formData).then(function (response) {
            if ('error' in response.data) { // This happens when the form fails to validate but no server error encountered
                vm.errorMessages.push(response.data.error);
                onFailure();          // Since all validation also happens on the client, this should never happen.
                vm.loadingData = false;
                return;
            }

            vm.formData = response.data;
            if (angular.isString(vm.formData.embargo)) {
                vm.formData.embargo = new Date(vm.formData.embargo);
            }

            // Just for debugging:
            if (angular.isDate(vm.formData.embargo)) {
                $log.info("vm.formData.embargo is a date.");
            }
            if (angular.isString(vm.formData.embargo)) {
                $log.info("vm.formData.embargo is a string.");
            }

            // If this instance of saveFormState was called by vm.saveAndClose, then
            // when we call onComplete (a.k.a. onSuccess), vm.formData.publicationId
            // will be passed to ngDialog's closeThisDialog.
            // (It was formerly saved to a "publication_id" global variable.)
            // The publicationId passed by closeThisDialog can be received by preCloseCallback
            // and used to redirect to the new publication's experiment view URL.

//          vm.infoMessage = "Dataset selection saved!";
            onComplete();
            vm.loadingData = false;
        },
        function (response) {
            vm.errorMessages.push("the server could not process your request");
            onFailure();
            vm.loadingData = false;
        });
        /* eslint-enable no-unused-vars */
    };

    // ***************
    // Form validators
    // ***************
    // A validator should take two functions as arguments:
    //   a function to be called when validation succeeds
    //   a function to be called when validation fails
    // Any error messages may be displayed in the vm.errorMessages array
    /* eslint-disable no-unused-vars */
    var noValidation = function (onSuccess, onError) {
        onSuccess();
    };
    /* eslint-enable no-unused-vars */
    var datasetSelectionValidator = function (onSuccess, onError) {

        extraInfoHelpers = []; // This list of helper functions must be cleared in case the discipline specific form info changes

        vm.formData.action = "update-dataset-selection";

        if (vm.formData.publicationTitle.trim().length === 0) {
            vm.errorMessages.push("A title must be given");
        }

        if (vm.formData.publicationDescription.trim().length === 0) {
            vm.errorMessages.push("Provide a description");
        }

        if (vm.formData.addedDatasets.length === 0) {
            vm.errorMessages.push("At least one dataset must be selected");
        }

        if (vm.errorMessages.length > 0) { // call onError if the form didn't validate
            onError();
        } else {
            // If the form is okay, send to the server
            saveFormState(onSuccess, function () {
                // If an error occurred...
                onError();
            });
        }
    };


    var extraInfoHelpers = []; // array of functions that evaluate to true if there are no errors
                               // extraInfoHelpers are registered elsewhere
    var extraInformationValidator = function (onSuccess, onError) {

        var errors = false;

        for (var i = 0; i < extraInfoHelpers.length; i++) {
            if (!extraInfoHelpers[i]()) {
                errors = true;
            }
        }

        if (errors) {
            onError();
        } else {
            vm.formData.action = "update-extra-info";
            saveFormState(onSuccess, onError);
        }

    };

    var finalSubmissionValidator = function (onSuccess, onError) {

        vm.formData.action = "submit";

        var errors = false;
        if (vm.formData.authors.length === 0) {
            vm.errorMessages.push("You must add at least one author.");
            errors = true;
        }

        var tmpAuthors = [];
        for (var a in vm.formData.authors) {
        if (vm.formData.authors.hasOwnProperty(a)) {
            var author = vm.formData.authors[a];
            var x = 0;
            if (angular.isUndefined(author.email) || author.email.trim().length === 0) {
                x++;
            }
            if (angular.isUndefined(author.name) || author.name.trim().length === 0) {
                x++;
            }
            if (angular.isUndefined(author.institution) || author.institution.trim().length === 0) {
                x++;
            }
            if (x === 0) {
                tmpAuthors.push(author);
            } else if (x < 3) {
                errors = true;
                vm.errorMessages.push("Invalid author entries.");
                break;
            }
        }
        }
        if (!errors) {
            vm.formData.authors = tmpAuthors;
        }

        if (angular.isUndefined(vm.formData.embargo) || vm.formData.embargo === null) {
            vm.errorMessages.push("Release date cannot be blank.");
            errors = true;
        }

        if (errors) {
            onError();
        } else {
            saveFormState(onSuccess, onError);
        }
    };

    // A list of available pages of the form, along with a function used to validate the form content
    vm.formPages = [{
        title: '',
        url: 'form_page1.html',
        validationFunction: noValidation
    },
        {
            title: 'Select datasets',
            url: 'form_page2.html',
            validationFunction: datasetSelectionValidator
        },
        {
            title: 'Extra information',
            url: 'form_page3.html',
            validationFunction: extraInformationValidator
        },
        {
            title: 'Attribution and licensing',
            url: 'form_page4.html',
            validationFunction: finalSubmissionValidator
        },
        {
            title: 'Submission complete',
            url: 'form_page5.html',
            validationFunction: noValidation
        }];
    vm.totalPages = vm.formPages.length;
    vm.currentPage = vm.formPages[vm.currentPageIdx];

    // Load the available experiments and datasets
    vm.loadingData = true; // Loading animation shown when this is true
    $http.get('/apps/publication-workflow/data/fetch_experiments_and_datasets/').then(function (response) {
        vm.experiments = response.data;

        // Set default experiment
        for (var i = 0; i < vm.experiments.length; i++) {
            if (vm.experiments[i].id === vm.experiment) {
                vm.selectedExperiment = vm.experiments[i];
                break;
            }
        }
        vm.loadingData = false;
    });


    // Add a dataset to the list of selected datasets
    vm.addDatasets = function (experiment, datasets) {
        if (angular.isUndefined(datasets)) {
            return;
        }
        for (var i = 0; i < datasets.length; i++) {
            vm.formData.addedDatasets.push({
                "experiment": experiment.title,
                "experiment_id": experiment.id,
                "dataset": datasets[i]
            });
        }
    };
    // Remove a dataset from the list of selected datasets
    vm.removeDataset = function (dataset) {
        var index = vm.formData.addedDatasets.indexOf(dataset);
        if (index > -1) {
            vm.formData.addedDatasets.splice(index, 1);
        }
    };

    // Advance to the next page of the form
    vm.nextPage = function () {
        angular.element($document[0].querySelector('.ngdialog')).scrollTop(0);
        if (vm.currentPageIdx < vm.formPages.length - 1 && !vm.loadingData) {
            vm.errorMessages = [];
            vm.infoMessage = "";
            vm.currentPage.validationFunction(function () { // On success...
                vm.currentPageIdx++;
                vm.currentPage = vm.formPages[vm.currentPageIdx];
            }, function () { // On error...
                // do nothing...
            });
        }
    };
    // Move back a page
    vm.previousPage = function () {
        if (vm.currentPageIdx - 1 >= 0 && !vm.loadingData) {
            vm.errorMessages = [];
            vm.infoMessage = "";
            vm.currentPageIdx--;
            vm.currentPage = vm.formPages[vm.currentPageIdx];
        } else if (vm.currentPageIdx === 0) {
            ngDialog.close();
        }
    };

    vm.isComplete = function () {
        return vm.currentPageIdx === (vm.formPages.length - 1);
    };

    vm.isLastPage = function () { // Actually, second last page
        return vm.currentPageIdx === (vm.formPages.length - 2);
    };

    // Set the publication title
    vm.setTitle = function (title) {
        vm.formData.publicationTitle = title;
    };

    vm.setDescription = function (description) {
        vm.formData.publicationDescription = description;
    };

    // Scroll the dataset list to top
    vm.scrollDsSelectorToTop = function() {
        angular.element($document[0].querySelector('#datasetList')).scrollTop(0);
    };

    // Add author to publication
    vm.addAuthorEntry = function () {
        $log.info(vm.formData);
        vm.formData.authors.push(
            {
                'name': '',
                'institution':'',
                'email': ''
            }
        );
    };

    // Remove author from publication
    vm.removeAuthorEntry = function (idx) {
        vm.formData.authors.splice(idx, 1);
    };

    // Copy acknowledgement text to acknowledgement field
    vm.copyAcknowledgement = function (text) {
        if (vm.formData.acknowledgements.indexOf(text) === -1) {
            if (vm.formData.acknowledgements.length > 0) {
                vm.formData.acknowledgements += " ";
            }
            vm.formData.acknowledgements += text;
        }
    };

    /* eslint-disable no-unused-vars */
    $scope.$watch('formData.selectedLicenseId', function (newVal, oldVal) {
        if (angular.isDefined(vm.formData.licenses)) {
            for (var i in vm.formData.licenses) {
                if (vm.formData.licenses.hasOwnProperty(i)) {
                    var license = vm.formData.licenses[i];
                    if (license.id === newVal) {
                        vm.formData.selectedLicense = license;
                        break;
                    }
                }
            }
        }
    });
    /* eslint-enable no-unused-vars */

    vm.saveAndClose = function () {
        angular.element($document[0].querySelector('.ngdialog')).scrollTop(0);
        saveFormState(
            function () { // On success
                // Preventing using $scope directly silences ESLint's angular/controller-as error:
                var dialogScope = $scope;
                dialogScope.closeThisDialog(vm.formData.publicationId);
            },
            function () {
            } // On error
        );
    };


    vm.setEmbargoToToday = function () {
        vm.formData.embargo = new Date();
    };
    // Ensures that the embargo date is a Date object
    /* eslint-disable no-unused-vars */
    $scope.$watch('formData.embargo', function (newVal, oldVal) {
        if (angular.isString(newVal)) {
            vm.formData.embargo = new Date(newVal);
        }
    });
    /* eslint-enable no-unused-vars */

    // #### PDB HELPER ####
    vm.requirePDBHelper = function () {
        extraInfoHelpers.push(function () {
            if (angular.isUndefined(vm.pdbOK) || vm.pdbOK === false) {
                vm.errorMessages.push("PDB ID invalid or not given");
                return false;
            } else {
                return true;
            }
        });
    };
    vm.pdbSearching = false;
    vm.pdbSearchComplete = false;
    /* eslint-disable no-unused-vars */
    $scope.$watch('formData.pdbInfo', function (newVal, oldVal) {
        if (angular.isDefined(newVal)) {
            vm.pdbSearchComplete = Object.keys(newVal).length;
            vm.pdbOK = (newVal.status !== 'UNKNOWN');
        } else if (angular.isDefined(vm.pdbOK) || vm.hasPDB) {
            delete vm.pdbOK;  // unset the variable so the form validator can continue
        }
    });
    /* eslint-enable no-unused-vars */


    var pdbSearchTimeout;
    vm.performPDBSearch = function (pdbId) {
        vm.pdbSearching = true;
        vm.pdbSearchComplete = false;
        vm.pdbOK = false;
        if (pdbSearchTimeout) {
            $timeout.cancel(pdbSearchTimeout);
        }

        pdbSearchTimeout = $timeout(function () {
            $http.get('/apps/publication-workflow/helper/pdb/' + pdbId + '/').then(
                function (response) {
                    vm.pdbSearching = false;
                    vm.pdbSearchComplete = true;
                    vm.formData.pdbInfo = response.data;
                }
            );
        }, 1000);
    };
});
