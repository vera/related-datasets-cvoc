// This script is based on the ror.js script by Jim Myers (@qqmyers)
// https://github.com/gdcc/dataverse-external-vocab-support/blob/b5390e769815ce01fb59e3ac94220d28e565914d/scripts/ror.js

var relatedDatasetIdSelector = "span[data-cvoc-protocol='related-dataset-id']";
var relatedDatasetRelationTypeSelector = "span[data-cvoc-protocol='related-dataset-relation-type']";
var relatedDatasetsSelector = "tr#metadata_relatedDatasetV2 td";
var relatedDatasetIdInputSelector = "input[data-cvoc-protocol='related-dataset-id']";
var relatedDatasetRelationTypeInputSelector = "div[data-cvoc-managed-field='relatedDatasetRelationType']";
var datasetRetrievalUrl = "/api/search";

$(document).ready(function() {
    displayRelatedDatasets();
    createInputForRelatedDatasets();
});

// This function handles display of related datasets on the dataset page
function displayRelatedDatasets() {
    // Clear duplicate display of the field values
    // (both datasetId and relationType are presented on the page twice, first as plain text, then inside a span)
    // Here, we remove the first occurence
    $(relatedDatasetIdSelector).each(function() {
        var relatedDatasetIdElement = this;
        if (!$(relatedDatasetIdElement).hasClass('deduplicated')) {
            let prev = $(relatedDatasetIdElement)[0].previousSibling;
            if(prev !== undefined) {
                $(relatedDatasetIdElement)[0].previousSibling.data = "";
            }
            $(relatedDatasetIdElement).addClass('deduplicated');
        }
    });
    $(relatedDatasetRelationTypeSelector).each(function() {
        var relatedDatasetRelationTypeElement = this;
        if (!$(relatedDatasetRelationTypeElement).hasClass('deduplicated')) {
            let prev = $(relatedDatasetRelationTypeElement)[0].previousSibling;
            if(prev !== undefined) {
                $(relatedDatasetRelationTypeElement)[0].previousSibling.data = "";
            }
            $(relatedDatasetRelationTypeElement).addClass('deduplicated');
        }
    });
    
    // The related datasets are inside the table cell as pairs of spans (consisting of dataset ID and relation type) separated by <br>s
    // Convert this to a <ul><li>...</li>...</ul> structure instead
    var td = document.querySelector(relatedDatasetsSelector);
    if(td != null && !$(td).hasClass('converted-to-list')) {
        $(td).addClass('converted-to-list');

        var ul = document.createElement('ul');
        ul.setAttribute('id', 'relatedDatasetsList');
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
            li.appendChild(document.createTextNode('This dataset '));
            group.forEach(span => li.appendChild(span));
            if (group.length === 2) {
                li.insertBefore(document.createTextNode(' '), li.childNodes[2]);
            }
            ul.appendChild(li);
        });
        td.innerHTML = '';
        td.appendChild(ul);
    }
    
    // Replace dataset IDs with text
    $(relatedDatasetIdSelector).each(function() {
        var relatedDatasetIdElement = this;
        if (!$(relatedDatasetIdElement).hasClass('expanded')) {
            $(relatedDatasetIdElement).addClass('expanded');

            var url = relatedDatasetIdElement.textContent;

            // Check for cached entry
            let value = getValueById(url);
            if(value !=null) {
                $(relatedDatasetIdElement).html(getDisplayHtmlForRelatedDataset(value, url));
            } else {
                // Try it as a local dataset PID
                // TODO check first if it's actually a valid URL
                $.ajax({
                    type: "GET",
                    url: datasetRetrievalUrl,
                    data: {
                        'q': 'persistentUrl:"' + url + '"',
                        'type': 'dataset',
                    },
                    dataType: 'json',
                    headers: {
                        'Accept': 'application/json',
                    },
                    success: function(res) {
                        // Verify that the search found the correct dataset
                        if(res.status == 'OK' && res.data.total_count > 0 && res.data.items[0].url == url) {
                            var datasetText = res.data.items[0].citation;
                            $(relatedDatasetIdElement).html(getDisplayHtmlForRelatedDataset(datasetText, url));
                            //Store values in localStorage to avoid repeating calls
                            storeValueById(url, datasetText);
                        } else {
                            $(relatedDatasetIdElement).html(getDisplayHtmlForRelatedDataset(url));
                        }
                    },
                    failure: function(jqXHR, textStatus, errorThrown) {
                        // Generic logging - don't need to do anything if 404 (leave
                        // display as is)
                        if (jqXHR.status != 404) {
                            console.error("The following error occurred: " + textStatus, errorThrown);
                        }
                        $(relatedDatasetIdElement).html(getDisplayHtmlForRelatedDataset(url));
                    }
                });
            }
        }
    });

    // Get incoming relationships and display them as inferred, non-confirmed relationships
    var citation = $(".citation a");
    var relatedDatasetsList = $("ul#relatedDatasetsList");
    if(citation.length > 0 && !relatedDatasetsList.hasClass('inferred')) {
        relatedDatasetsList.addClass('inferred');
        // Get persistent URL of currently viewed dataset
        var persistentUrl = $(".citation a")[0].href;
        // TODO use cache
        $.ajax({
            type: "GET",
            url: datasetRetrievalUrl,
            data: {
                'q': 'relatedDatasetIdentifier:"' + persistentUrl + '"',
                'type': 'dataset',
                'metadata_fields': 'relatedDatasetsV2:*',
            },
            dataType: 'json',
            headers: {
                'Accept': 'application/json',
            },
            success: function(res) {
                if(res.status == 'OK' && res.data.total_count > 0) {
                    res.data.items.forEach(function(dataset) {
                        // To find the relation type, we walk through the list of relationships
                        dataset.metadataBlocks.relatedDatasetsV2.fields[0].value.forEach(function(relationship) {
                            // Only consider relationships to the currently viewed dataset
                            // TODO in a future version of the search, it might be possible to return only those
                            if(relationship.relatedDatasetIdentifier.value == persistentUrl) {
                                relatedDatasetsList.append($('<li></li>').append(getDisplayHtmlForRelatedDataset(dataset.citation, dataset.url), ' ', relationship.relatedDatasetRelationType.value, ' this dataset ', $('<i></i>').addClass('text-muted').append(' (', $('<span></span>').addClass('glyphicon glyphicon-exclamation-sign'), ' This relationship has been automatically inferred and has not been confirmed by this dataset\'s owner.)')));
                            }
                        });
                    });
                }
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

// source: https://stackoverflow.com/a/43467144
function isValidHttpUrl(string) {
    var url;
    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
}

function getDisplayHtmlForRelatedDataset(name, url) {
    if(url != null && isValidHttpUrl(url)) {
        // for datasets local to this Dataverse instance, we have the URL and the dataset name
        name = '<a href="' + url + '" target="_blank" rel="nofollow"><span class="glyphicon glyphicon-new-window"></span> '+ name +'</a>';
    } else if(isValidHttpUrl(name)) {
        // for external datasets, the entered identifier may also be a URL
        name = '<a href="' + name + '" target="_blank" rel="nofollow"><span class="glyphicon glyphicon-new-window"></span> '+ name +'</a>';
    }
    return $('<span></span>').append(name);
}

function createInputForRelatedDatasets() {
    // For each related dataset ID input element
    $(relatedDatasetIdInputSelector).each(function() {
        var relatedDatasetIdInput = this;
        if (!relatedDatasetIdInput.hasAttribute('data-related-dataset-id')) {
            // Random identifier
            let num = Math.floor(Math.random() * 100000000000);
            // Hide the actual input and give it a data-related-dataset-id number so we can
            // find it
            $(relatedDatasetIdInput).hide();
            $(relatedDatasetIdInput).attr('data-related-dataset-id', num);

            // Increase width of parent div (dataset IDs are usually long and the input should be full width)
            relatedDatasetIdInput.parentNode.classList.remove('col-sm-6');
            relatedDatasetIdInput.parentNode.classList.add('col-sm-12');

            // Todo: if not displayed, wait until it is to then create the
            // select 2 with a non-zero width
            // Add a select2 element to allow search and provide a list of
            // choices
            var selectId = "relatedDatasetIdAddSelect_" + num;
            $(relatedDatasetIdInput).after(
                '<select id=' + selectId + ' class="form-control add-resource select2" tabindex="0" >');
            $("#" + selectId).select2({
                theme: "classic",
                tags: $(relatedDatasetIdInput).attr('data-cvoc-allowfreetext'),
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
                    if(item.text != item.id) {
                        // Only for datasets local to this Dataverse instance we have display text in addition to the ID
                        return getDisplayHtmlForRelatedDataset(item.text, item.id);
                    } else {
                        return getDisplayHtmlForRelatedDataset(item.id);
                    }
                },
                language: {
                    searching: function(params) {
                        // Change this to be appropriate for your application
                        return 'Searching for dataset…';
                    }
                },
                placeholder: relatedDatasetIdInput.hasAttribute("data-cvoc-placeholder") ? $(relatedDatasetIdInput).attr('data-cvoc-placeholder') : "Select a related dataset…",
                minimumInputLength: 3,
                allowClear: true,
                ajax: {
                    // Use an ajax call to retrieve matching results
                    url: datasetRetrievalUrl,
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
                        return {
                            results: data['data']['items']
                                .map(
                                    function(x) {
                                        return {
                                            text: x.citation,
                                            id: x.url
                                        }
                                    })
                        };
                    }
                }
            });

            //Add a tab stop and key handling to allow the clear button to be selected via tab/enter
            const observer = new MutationObserver((mutationList, observer) => {
                var button = $('#' + selectId).parent().find('.select2-selection__clear');
                button.attr("tabindex","0");
                button.on('keydown',function(e) {
                    if(e.which == 13) {
                        $('#' + selectId).val(null).trigger('change');
                    }
                });
            });

            observer.observe($('#' + selectId).parent()[0], {
                childList: true,
                subtree: true
            });

            // If the input has a value already, format it the same way as if it
            // were a new selection
            var id = $(relatedDatasetIdInput).val();
            // TODO this duplicates some code from displayRelatedDatasets
            let value = getValueById(id);
            if(value !=null) {
                var newOption = new Option(value, id, true, true)
                $('#' + selectId).append(newOption).trigger('change');
            } else {
                if(isValidHttpUrl(id)) {
                    // To find out if the URL ID belongs to a dataset in this Dataverse instance,
                    // just query for it
                    $.ajax({
                        type: "GET",
                        url: datasetRetrievalUrl,
                        data: {
                            'q': 'persistentUrl:"' + id + '"',
                            'type': 'dataset',
                        },
                        dataType: 'json',
                        headers: {
                            'Accept': 'application/json',
                        },
                        success: function(res) {
                            // Verify that the search found the correct dataset
                            if(res.status == 'OK' && res.data.total_count > 0 && res.data.items[0].url == id) {
                                var datasetText = res.data.items[0].citation;
                                var newOption = new Option(datasetText, id, true, true)
                                $('#' + selectId).append(newOption).trigger('change');
                            } else {
                                var newOption = new Option(id, id, true, true)
                                $('#' + selectId).append(newOption).trigger('change');
                            }
                        },
                        failure: function(jqXHR, textStatus, errorThrown) {
                            // Generic logging - don't need to do anything if 404 (leave
                            // display as is)
                            if (jqXHR.status != 404) {
                                console.error("The following error occurred: " + textStatus, errorThrown);
                            }
                            var newOption = new Option(id, id, true, true)
                            $('#' + selectId).append(newOption).trigger('change');
                        }
                    });
                } else {
                    // If it's not a valid URL, it's definitely an external dataset,
                    // so just display the text as it is
                    var newOption = new Option(id, id, true, true)
                    $('#' + selectId).append(newOption).trigger('change');
                }
            }

            // Could start with the selection menu open
            // $("#" + selectId).select2('open');

            // When a selection is made, set the value of the hidden input field
            $('#' + selectId).on('select2:select', function(e) {
                var data = e.params.data;
                $("input[data-related-dataset-id='" + num + "']").val(data.id);
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

    // For each related dataset relation type input element
    $(relatedDatasetRelationTypeInputSelector).each(function() {
        var relatedDatasetRelationTypeInput = this;
        if(!$(relatedDatasetRelationTypeInput).hasClass('prettied')) {
            $(relatedDatasetRelationTypeInput).addClass('prettied');

            // Increase width of parent div
            relatedDatasetRelationTypeInput.parentNode.classList.remove('col-sm-6');
            relatedDatasetRelationTypeInput.parentNode.classList.add('col-sm-12');

            // Add text for prettier input
            $(relatedDatasetRelationTypeInput).prepend($('<span></span>').append("This dataset…"));
        }
    });
}
