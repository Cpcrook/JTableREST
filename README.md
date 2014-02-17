JTableREST
==========

Plug that defaults AJAX verbs for grid CRUD actions to RESTful verbs rather than defaulting to POST.

Adds the following option defaults:

options : {

...

listVerb : "GET",
createVerb : "POST",
updateVerb : "PUT",
deleteVerb : "DELETE"

...

}

Adds private methods and overrides _ajax, _submitForWithAjax methods to include specified verbs.

DELETE "id" (key) field is appended to deleteAction endpoint URL.
