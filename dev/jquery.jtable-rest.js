(function(){
/** jTable RESTful plug-in
	
	Chris Crook
	2/18/2014
	<MIT license>
	
	Allows user to specify AJAX request verbs for each CRUD action type in order to allow usage of RESTfully-implemented
	web services, rather than the default POST-everything functionality.
	
**/
var extensions = {

	//Add new actionVerbs option & set defaults
	options : {
		actionVerbs : {
			createVerb : "POST",
			listVerb : "GET",
			updateVerb : "PUT",
			deleteVerb : "DELETE"
		}
	},
	/* Override the _ajax private method to accept the "type" parameter so actionTypes can be passed to it */
	_ajax: function (options) {
            var opts = $.extend({}, this.options.ajaxSettings, options);

            //Override success
            opts.success = function (data) {
                if (options.success) {
                    options.success(data);
                }
            };

            //Override error
            opts.error = function (jqXHR, textStatus, errorThrown) {
                if (unloadingPage) {
                    jqXHR.abort();
                    return;
                }
                
                if (options.error) {
                    options.error(arguments);
                }
            };

            //Override complete
            opts.complete = function () {
                if (options.complete) {
                    options.complete();
                }
            };

            $.ajax(opts);
        },
	
	/* Override the _submitFormUsingAjax private method to add parameter "type" in order to pass ajax action call types*/
	_submitFormUsingAjax: function (url, formData, success, error, type) {
            if (type == undefined)
                type = "POST";
            this._ajax({
                url: url,
                type: type,
                data: formData,
                success: success,
                error: error
            });
        },
	
	/**
	*	CREATE RECORD OVERRIDES
	**/
	
	addRecord: function (options) {
            var self = this;
            options = $.extend({
                clientOnly: false,
                animationsEnabled: self.options.animationsEnabled,
                url: self.options.actions.createAction,
                success: function () { },
                error: function () { },
                type: self.options.actionVerbs.createVerb
            }, options);

            if (!options.record) {
                self._logWarn('options parameter in addRecord method must contain a record property.');
                return;
            }

            if (options.clientOnly) {
                self._addRow(
                    self._createRowFromRecord(options.record), {
                        isNewRow: true,
                        animationsEnabled: options.animationsEnabled
                    });
                
                options.success();
                return;
            }

            self._submitFormUsingAjax(
                options.url,
                $.param(options.record),
                function (data) {
                    if (data.Result != 'OK') {
                        self._showError(data.Message);
                        options.error(data);
                        return;
                    }
                    
                    if(!data.Record) {
                        self._logError('Server must return the created Record object.');
                        options.error(data);
                        return;
                    }

                    self._onRecordAdded(data);
                    
                    self._addRow(
                        self._createRowFromRecord(data.Record), {
                            isNewRow: true,
                            animationsEnabled: options.animationsEnabled
                        });

                    options.success(data);
                },
                function () {
                    self._showError(self.options.messages.serverCommunicationError);
                    options.error();
                },
                options.type);
        },
		_saveAddRecordForm: function ($addRecordForm, $saveButton) {
            var self = this;

            //Make an Ajax call to update record
            $addRecordForm.data('submitting', true);

            self._submitFormUsingAjax(
                self.options.actions.createAction,
                $addRecordForm.serialize(),
                function (data) {
                    
                    if (data.Result != 'OK') {
                        self._showError(data.Message);
                        self._setEnabledOfDialogButton($saveButton, true, self.options.messages.save);
                        return;
                    }
                    
                    if (!data.Record) {
                        self._logError('Server must return the created Record object.');
                        self._setEnabledOfDialogButton($saveButton, true, self.options.messages.save);
                        return;
                    }

                    self._onRecordAdded(data);
                    self._addRow(
                        self._createRowFromRecord(data.Record), {
                            isNewRow: true
                        });
                    self._$addRecordDiv.dialog("close");
                },
                function () {
                    self._showError(self.options.messages.serverCommunicationError);
                    self._setEnabledOfDialogButton($saveButton, true, self.options.messages.save);
                },
                self.options.actionVerbs.createVerb;
        },
		
		/**
		*	UPDATE METHOD OVERRIDES
		**/
		
		updateRecord: function (options) {
            var self = this;
            options = $.extend({
                clientOnly: false,
                animationsEnabled: self.options.animationsEnabled,
                url: self.options.actions.updateAction,
                type: self.options.actionVerbs.updateVerb,
                success: function () { },
                error: function () { }
            }, options);

            if (!options.record) {
                self._logWarn('options parameter in updateRecord method must contain a record property.');
                return;
            }

            var key = self._getKeyValueOfRecord(options.record);
            if (key == undefined || key == null) {
                self._logWarn('options parameter in updateRecord method must contain a record that contains the key field property.');
                return;
            }

            var $updatingRow = self.getRowByKey(key);
            if ($updatingRow == null) {
                self._logWarn('Can not found any row by key: ' + key);
                return;
            }

            if (options.clientOnly) {
                $.extend($updatingRow.data('record'), options.record);
                self._updateRowTexts($updatingRow);
                self._onRecordUpdated($updatingRow, null);
                if (options.animationsEnabled) {
                    self._showUpdateAnimationForRow($updatingRow);
                }

                options.success();
                return;
            }

            self._submitFormUsingAjax(
                options.url,
                $.param(options.record),
                function (data) {
                    if (data.Result != 'OK') {
                        self._showError(data.Message);
                        options.error(data);
                        return;
                    }

                    $.extend($updatingRow.data('record'), options.record);
                    self._updateRecordValuesFromServerResponse($updatingRow.data('record'), data);

                    self._updateRowTexts($updatingRow);
                    self._onRecordUpdated($updatingRow, data);
                    if (options.animationsEnabled) {
                        self._showUpdateAnimationForRow($updatingRow);
                    }

                    options.success(data);
                },
                function () {
                    self._showError(self.options.messages.serverCommunicationError);
                    options.error();
                },
                options.type);
        },
		_saveEditForm: function ($editForm, $saveButton) {
            var self = this;
            self._submitFormUsingAjax(
                self.options.actions.updateAction,
                $editForm.serialize(),
                function (data) {
                    //Check for errors
                    if (data.Result != 'OK') {
                        self._showError(data.Message);
                        self._setEnabledOfDialogButton($saveButton, true, self.options.messages.save);
                        return;
                    }

                    var record = self._$editingRow.data('record');

                    self._updateRecordValuesFromForm(record, $editForm);
                    self._updateRecordValuesFromServerResponse(record, data);
                    self._updateRowTexts(self._$editingRow);

                    self._$editingRow.attr('data-record-key', self._getKeyValueOfRecord(record));

                    self._onRecordUpdated(self._$editingRow, data);

                    if (self.options.animationsEnabled) {
                        self._showUpdateAnimationForRow(self._$editingRow);
                    }

                    self._$editDiv.dialog("close");
                },
                function () {
                    self._showError(self.options.messages.serverCommunicationError);
                    self._setEnabledOfDialogButton($saveButton, true, self.options.messages.save);
                },
                self.options.actionVerbs.updateAction);
        },
		/** DELETE METHOD OVERRIDES **/
		_createDeleteDialogDiv: function () {
            var self = this;
            
            //Check if deleteAction is supplied
            if (!self.options.actions.deleteAction) {
                return;
            }

            //Create div element for delete confirmation dialog
            self._$deleteRecordDiv = $('<div><p><span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span><span class="jtable-delete-confirm-message"></span></p></div>').appendTo(self._$mainContainer);

            //Prepare dialog
            self._$deleteRecordDiv.dialog({
                autoOpen: false,
                show: self.options.dialogShowEffect,
                hide: self.options.dialogHideEffect,
                modal: true,
                title: self.options.messages.areYouSure,
                buttons:
                        [{  //cancel button
                            text: self.options.messages.cancel,
                            click: function () {
                                self._$deleteRecordDiv.dialog("close");
                            }
                        }, {//delete button
                            id: 'DeleteDialogButton',
                            text: self.options.messages.deleteText,
                            click: function () {
                                
                                //row maybe removed by another source, if so, do nothing
                                if (self._$deletingRow.hasClass('jtable-row-removed')) {
                                    self._$deleteRecordDiv.dialog('close');
                                    return;
                                }

                                var $deleteButton = $('#DeleteDialogButton');
                                self._setEnabledOfDialogButton($deleteButton, false, self.options.messages.deleting);
                                self._deleteRecordFromServer(
                                    self._$deletingRow,
                                    function () {
                                        self._removeRowsFromTableWithAnimation(self._$deletingRow);
                                        self._$deleteRecordDiv.dialog('close');
                                    },
                                    function (message) { //error
                                        self._showError(message);
                                        self._setEnabledOfDialogButton($deleteButton, true, self.options.messages.deleteText);
                                    },
                                    self.options.actions.deleteAction,
                                    self.options.actionVerbs.deleteVerb
                                );
                            }
                        }],
                close: function () {
                    var $deleteButton = $('#DeleteDialogButton');
                    self._setEnabledOfDialogButton($deleteButton, true, self.options.messages.deleteText);
                }
            });
        },
		//PUBLIC DELETE OVERRIDES
		deleteRows: function ($rows) {
            var self = this;

            if ($rows.length <= 0) {
                self._logWarn('No rows specified to jTable deleteRows method.');
                return;
            }
            
            if (self._isBusy()) {
                self._logWarn('Can not delete rows since jTable is busy!');
                return;
            }

            //Deleting just one row
            if ($rows.length == 1) {
                self._deleteRecordFromServer(
                    $rows,
                    function () { //success
                        self._removeRowsFromTableWithAnimation($rows);
                    },
                    function (message) { //error
                        self._showError(message);
                    },
                    self.options.actions.deleteAction,
                    self.options.actionVerbs.deleteVerb
                );

                return;
            }

            //Deleting multiple rows
            self._showBusy(self._formatString(self.options.messages.deleteProggress, 0, $rows.length));

            //This method checks if deleting of all records is completed
            var completedCount = 0;
            var isCompleted = function () {
                return (completedCount >= $rows.length);
            };

            //This method is called when deleting of all records completed
            var completed = function () {
                var $deletedRows = $rows.filter('.jtable-row-ready-to-remove');
                if ($deletedRows.length < $rows.length) {
                    self._showError(self._formatString(self.options.messages.canNotDeletedRecords, $rows.length - $deletedRows.length, $rows.length));
                }

                if ($deletedRows.length > 0) {
                    self._removeRowsFromTableWithAnimation($deletedRows);
                }

                self._hideBusy();
            };

            //Delete all rows
            var deletedCount = 0;
            $rows.each(function () {
                var $row = $(this);
                self._deleteRecordFromServer(
                    $row,
                    function () { //success
                        ++deletedCount; ++completedCount;
                        $row.addClass('jtable-row-ready-to-remove');
                        self._showBusy(self._formatString(self.options.messages.deleteProggress, deletedCount, $rows.length));
                        if (isCompleted()) {
                            completed();
                        }
                    },
                    function () { //error
                        ++completedCount;
                        if (isCompleted()) {
                            completed();
                        }
                    },
                    self.options.actions.deleteAction,
                    self.options.actionVerbs.deleteVerb
                );
            });
        },

        /* Deletes a record from the table (optionally from the server also).
        *************************************************************************/
        deleteRecord: function (options) {
            var self = this;
            options = $.extend({
                clientOnly: false,
                animationsEnabled: self.options.animationsEnabled,
                url: self.options.actions.deleteAction,
                success: function () { },
                error: function () { },
                type: self.options.actionVerbs.deleteVerb
            }, options);

            if (options.key == undefined) {
                self._logWarn('options parameter in deleteRecord method must contain a key property.');
                return;
            }

            var $deletingRow = self.getRowByKey(options.key);
            if ($deletingRow == null) {
                self._logWarn('Can not found any row by key: ' + options.key);
                return;
            }

            if (options.clientOnly) {
                self._removeRowsFromTableWithAnimation($deletingRow, options.animationsEnabled);
                options.success();
                return;
            }

            self._deleteRecordFromServer(
                    $deletingRow,
                    function (data) { //success
                        self._removeRowsFromTableWithAnimation($deletingRow, options.animationsEnabled);
                        options.success(data);
                    },
                    function (message) { //error
                        self._showError(message);
                        options.error(message);
                    },
                    options.url,
                    options.type
                );
        },
		_deleteButtonClickedForRow: function ($row) {
            var self = this;

            var deleteConfirm;
            var deleteConfirmMessage = self.options.messages.deleteConfirmation;

            //If options.deleteConfirmation is function then call it
            if ($.isFunction(self.options.deleteConfirmation)) {
                var data = { row: $row, record: $row.data('record'), deleteConfirm: true, deleteConfirmMessage: deleteConfirmMessage, cancel: false, cancelMessage: null };
                self.options.deleteConfirmation(data);

                //If delete progress is cancelled
                if (data.cancel) {

                    //If a canlellation reason is specified
                    if (data.cancelMessage) {
                        self._showError(data.cancelMessage); //TODO: show warning/stop message instead of error (also show warning/error ui icon)!
                    }

                    return;
                }

                deleteConfirmMessage = data.deleteConfirmMessage;
                deleteConfirm = data.deleteConfirm;
            } else {
                deleteConfirm = self.options.deleteConfirmation;
            }

            if (deleteConfirm != false) {
                //Confirmation
                self._$deleteRecordDiv.find('.jtable-delete-confirm-message').html(deleteConfirmMessage);
                self._showDeleteDialog($row);
            } else {
                //No confirmation
                self._deleteRecordFromServer(
                    $row,
                    function() { //success
                        self._removeRowsFromTableWithAnimation($row);
                    },
                    function(message) { //error
                        self._showError(message);
                    },
                    self.options.actions.deleteAction,
                    self.options.actionVerbs.deleteVerb)
                );
            }
        },
		/** LOADING / READING METHOD OVERRIDES **/
		_reloadTable: function (completeCallback) {
            var self = this;

            //Disable table since it's busy
            self._showBusy(self.options.messages.loadingMessage, self.options.loadingAnimationDelay);

            //Generate URL (with query string parameters) to load records
            var loadUrl = this.options.actions.listAction;
            var loadAjaxRequestType = this.options.actionVerbs.listVerb;
            
            //Load data from server
            self._onLoadingRecords();
            self._ajax({
                url: loadUrl,
                type: loadAjaxRequestType,
                data: self._lastPostData,
                success: function (data) {
                    self._hideBusy();

                    //Show the error message if server returns error
                    if (data.Result != 'OK') {
                        self._showError(data.Message);
                        return;
                    }

                    //Re-generate table rows
                    self._removeAllRows('reloading');
                    self._addRecordsToTable(data.Records);

                    self._onRecordsLoaded(data);

                    //Call complete callback
                    if (completeCallback) {
                        completeCallback();
                    }
                },
                error: function () {
                    self._hideBusy();
                    self._showError(self.options.messages.serverCommunicationError);
                }
            });
        },
		
		
		
};


$.extend(true, $.hik.jtable.prototype, extensions);
})(JQuery)