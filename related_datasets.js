var relatedDatasetIdSelector = "span[data-cvoc-protocol='related-dataset-id']";
var relatedDatasetRelationTypeSelector = "span[data-cvoc-protocol='related-dataset-relation-type']";
var relatedDatasetsSelector = "tr#metadata_relatedDatasetV2 td";
var rorInputSelector = "input[data-cvoc-protocol='related-dataset-id']";
var datasetAutocompleteUrl = "/api/search";
var datasetRetrievalUrl = "/api/datasets/:persistentId";
var rorIdStem = "https://ror.org/";
var rorPrefix = "ror";

//Max chars that displays well for a child field
var rorMaxLength = 31;

$(document).ready(function() {
    displayRelatedDatasets();
    updateRorInputs();
});

// This function handles display of related datasets on the dataset page
function displayRelatedDatasets() {
    // Clear duplicate display of the field values
    // (both datasetId and relationType are presented on the page twice, first as plain text, then inside a span)
    // Here, we remove the first occurence
    $(relatedDatasetIdSelector).each(function() {
        var rorElement = this;
        if (!$(rorElement).hasClass('deduplicated')) {
            let prev = $(rorElement)[0].previousSibling;
            if(prev !== undefined) {
                $(rorElement)[0].previousSibling.data = "";
            }
            $(rorElement).addClass('deduplicated');
        }
    });
    $(relatedDatasetRelationTypeSelector).each(function() {
        var rorElement = this;
        if (!$(rorElement).hasClass('deduplicated')) {
            let prev = $(rorElement)[0].previousSibling;
            if(prev !== undefined) {
                $(rorElement)[0].previousSibling.data = "";
            }
            $(rorElement).addClass('deduplicated');
        }
    });
    
    // The related datasets are inside the table cell as pairs of spans (consisting of dataset ID and relation type) separated by <br>s
    // Convert this to a <ul><li>...</li>...</ul> structure instead
    var td = document.querySelector(relatedDatasetsSelector);
    if(td != null && !$(td).hasClass('converted-to-list')) {
        $(td).addClass('converted-to-list');

        var ul = document.createElement('ul');
        var spans = td.querySelectorAll('span');
        var spanGroups = {};
        spans.forEach(span => {
            var index = span.getAttribute('data-cvoc-index');
            if (!spanGroups[index]) {
                spanGroups[index] = [];
            }
            spanGroups[index].push(span);
        });
        Object.values(spanGroups).forEach(group => {
            var li = document.createElement('li');
            group.forEach(span => li.appendChild(span));
            if (group.length === 2) {
                li.insertBefore(document.createTextNode(' '), li.childNodes[1]);
            }
            ul.appendChild(li);
        });
        td.innerHTML = '';
        td.appendChild(ul);
    }
    
    // Replace dataset IDs with title
    $(relatedDatasetIdSelector).each(function() {
        var rorElement = this;
        if (!$(rorElement).hasClass('expanded')) {
            $(rorElement).addClass('expanded');

            var id = rorElement.textContent;
            if (!id.startsWith("perma:")) { // TODO or other protocols
                $(rorElement).html(getRorDisplayHtml(id));
            } else {
                // Check for cached entry
                let value = getValue(id);
                if(value !=null) {
                    $(rorElement).html(getRorDisplayHtml(value));
                } else {
                    // Try it as a local dataset PID (could validate that it has the right form or can just let the GET fail)
                    $.ajax({
                        type: "GET",
                        url: datasetRetrievalUrl + "?persistentId=" + id,
                        dataType: 'json',
                        headers: {
                            'Accept': 'application/json',
                        },
                        success: function(res) {
                            // Assume the first field in the citation block is the dataset title
                            var datasetTitle = res.data.latestVersion.metadataBlocks.citation.fields[0].value;
                            $(rorElement).html(getRorDisplayHtml(datasetTitle));
                            //Store values in localStorage to avoid repeating calls
                            storeValue(id, datasetTitle);
                        },
                        failure: function(jqXHR, textStatus, errorThrown) {
                            // Generic logging - don't need to do anything if 404 (leave
                            // display as is)
                            if (jqXHR.status != 404) {
                                console.error("The following error occurred: " + textStatus, errorThrown);
                            }
                        }
                    });
                }
            }
        }
    });
}

function getRorDisplayHtml(name) {
    if (name.length >= rorMaxLength) {
        // show the first characters of a long name
        // return item.text.substring(0,25) + "…";
        name=name.substring(0,rorMaxLength) + "…";
    }
    /*if(url != null) {
      name =  name + '<a href="' + url + '" target="_blank" rel="nofollow" >' +'<img alt="ROR logo" src="https://raw.githubusercontent.com/ror-community/ror-logos/main/ror-icon-rgb.svg" height="20" class="ror"/></a>';
    }*/
    return $('<span></span>').append(name);
}

function updateRorInputs() {
    // For each input element within rorInputSelector elements
    $(rorInputSelector).each(function() {
        var rorInput = this;
        if (!rorInput.hasAttribute('data-related-dataset-id')) {
            // Random identifier
            let num = Math.floor(Math.random() * 100000000000);
            // Hide the actual input and give it a data-related-dataset-id number so we can
            // find it
            //$(rorInput).hide();
            $(rorInput).attr('data-related-dataset-id', num);
            // Todo: if not displayed, wait until it is to then create the
            // select 2 with a non-zero width
            // Add a select2 element to allow search and provide a list of
            // choices
            var selectId = "rorAddSelect_" + num;
            $(rorInput).after(
                '<select id=' + selectId + ' class="form-control add-resource select2" tabindex="0" >');
            $("#" + selectId).select2({
                theme: "classic",
                tags: $(rorInput).attr('data-cvoc-allowfreetext'),
                delay: 500,
                templateResult: function(item) {
                    // No need to template the searching text
                    if (item.loading) {
                        return item.text;
                    }
                    // markMatch bolds the search term if/where it appears in
                    // the result
                    var $result = markMatch2(item.text, term);
                    return $result;
                },
                templateSelection: function(item) {
                    // For a selection, format as in display mode
                    //Find/remove the id number
                    var name = item.text;
                    var pos = item.text.search(/, [a-z0-9]{9}/);
                    if (pos >= 0) {
                        name = name.substr(0, pos);
                        var idnum = item.text.substr(pos+2);
                        var altNames=[];
                        pos=idnum.indexOf(', ');
                        if(pos>0) {
                            altNames = idnum.substr(pos+2).split(',');
                            idnum=idnum.substr(0,pos);
                        }
                        return getRorDisplayHtml(name);
                    }
                    return getRorDisplayHtml(name);
                },
                language: {
                    searching: function(params) {
                        // Change this to be appropriate for your application
                        return 'Searching for dataset…';
                    }
                },
                placeholder: rorInput.hasAttribute("data-cvoc-placeholder") ? $(rorInput).attr('data-cvoc-placeholder') : "Select a related dataset…",
                minimumInputLength: 3,
                allowClear: true,
                ajax: {
                    // Use an ajax call to ROR to retrieve matching results
                    url: datasetAutocompleteUrl,
                    data: function(params) {
                        term = params.term;
                        if (!term) {
                            term = "";
                        }
                        var query = {
                            q: term.trim().replaceAll(' ', '* ') + '*',
                            type: 'dataset',
                        }
                        return query;
                    },
                    // request json
                    headers: {
                        'Accept': 'application/json'
                    },
                    processResults: function(data, params) {
                        //console.log("Data dump BEGIN");
                        //console.log(data);
                        //console.log("Data dump END");
                        return {
                            results: data['data']['items']
                                .map(
                                    function(x) {
                                        return {
                                            text: x.citation,
                                            id: x.global_id
                                        }
                                    })
                        };
                    }
                }
            });
          //Add a tab stop and key handling to allow the clear button to be selected via tab/enter
          const observer = new MutationObserver((mutationList, observer) => {
            var button = $('#' + selectId).parent().find('.select2-selection__clear');
            console.log("BL : " + button.length);
            button.attr("tabindex","0");
            button.on('keydown',function(e) {
              if(e.which == 13) {
                $('#' + selectId).val(null).trigger('change');
              }
            });
          });

          observer.observe($('#' + selectId).parent()[0], {
            childList: true,
            subtree: true }
          );

            // If the input has a value already, format it the same way as if it
            // were a new selection
            var id = $(rorInput).val();
            if (id.startsWith(rorIdStem)) {
                id = id.substring(rorIdStem.length);
                $.ajax({
                    type: "GET",
                    url: rorRetrievalUrl + "/" + id,
                    dataType: 'json',
                    headers: {
                        'Accept': 'application/json'
                    },
                    success: function(ror, status) {
                        var name = ror.name;
                        //Display the name and id number in the selection menu
                        var text = name + ", " + ror.id.replace(rorIdStem,'') +', ' + ror.acronyms;
                        var newOption = new Option(text, id, true, true);
                        $('#' + selectId).append(newOption).trigger('change');
                    },
                    failure: function(jqXHR, textStatus, errorThrown) {
                        if (jqXHR.status != 404) {
                            console.error("The following error occurred: " + textStatus, errorThrown);
                        }
                    }
                });
            } else {
                // If the initial value is not in ROR, just display it as is
                var newOption = new Option(id, id, true, true);
                newOption.altNames = ['No ROR Entry'];
                $('#' + selectId).append(newOption).trigger('change');
            }
            // Could start with the selection menu open
            // $("#" + selectId).select2('open');
            // When a selection is made, set the value of the hidden input field
            $('#' + selectId).on('select2:select', function(e) {
                var data = e.params.data;
                // For entries from ROR, the id and text are different
                //For plain text entries (legacy or if tags are allowed), they are the same
                if (data.id != data.text) {
                    // we want just the ror url
                    $("input[data-related-dataset-id='" + num + "']").val(data.id);
                } else {
                    // Tags are allowed, so just enter the text as is
                    $("input[data-related-dataset-id='" + num + "']").val(data.id);
                }
            });
            // When a selection is cleared, clear the hidden input
            $('#' + selectId).on('select2:clear', function(e) {
                $("input[data-related-dataset-id='" + num + "']").attr('value', '');
            });
            //When the field is selected via keyboard, move the focus and cursor to the new input
            $('#' + selectId).on('select2:open', function(e) {
              $(".select2-search__field").focus()
              $(".select2-search__field").attr("id",selectId + "_input")
              document.getElementById(selectId + "_input").select();

            });
        }
    });
}
