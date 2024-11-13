# Improved "Related Datasets" for Dataverse

This is a first prototype for an improved "Related Datasets" block in Dataverse. As described in our [feature proposal](https://docs.google.com/document/d/1VVF2v8OGB1LCN5XLG93tK6Lbz2DuP5AmefOQhbWtkEQ/edit?usp=sharing), the current system captures dataset relationships in unstructured string fields. This leads to limitations in how relationships can be utilized, searched, and displayed. The aim is to replace the current unstructured string fields used to capture dataset relationships with a more structured approach.

This prototype can be installed in any Dataverse instance (see instructions below). It does not change any existing metadata block, but adds a new block that can be used for trying out the feature. We are always happy to receive feedback on this prototype! 📬

## Features

* ✅ **Structured field for relationships:** Implements a structured field to store relationships, including:
   * *Dataset ID:* The unique identifier of the related dataset.
   * *Dataset ID type:* The type of the identifier (e.g., "URL", "DOI").
   * *Relationship type:* The type of relationship (e.g., "supplements," "continues") following DataCite relationship types.

![image](https://github.com/user-attachments/assets/7c481318-d169-4ab3-a210-9d02961bc45a)

* **User interface:**
   * ✅ *Dataset creation form:* Offer autocomplete for related datasets within the same Dataverse.
   * ✅ *Dataset page:* Display related datasets on the dataset page with clickable links.

* ✅ **Support for related external datasets:** Allows datasets to be linked not only within Dataverse but also to resources in other repositories or data sources such as Zenodo, DataCite, and others using external URIs.

![image](https://github.com/user-attachments/assets/9073dd2d-eb69-46eb-8aaa-c0fa4f957543)

![image](https://github.com/user-attachments/assets/fe4f0410-9362-4085-bf83-d8bc1d26d940)

![image](https://github.com/user-attachments/assets/77dc88f8-1e03-4966-b40a-79a4f3639de0)
 
* **Automatic inverse and transitive relationships:**
   * (✅) When a relationship is created in one direction, the corresponding reverse relationship is recorded for the other dataset.
   * ✅ To ensure clarity for users, so they can easily see whether a relationship was explicitly added or inferred by the system, automatically applied relationships are clearly marked in the UI.

![image](https://github.com/user-attachments/assets/9bcd24e6-bf35-4d37-a0ad-0b0b26dd741e)

* (✅) **API integration:** Related datasets are accessible via the API.

* (✅) **Search integration:** Integrates relationship data into the search logic to allow users to find datasets based on their relationships.

Further features are planned, but not yet developed. See [open issues](https://github.com/vera/related-datasets-cvoc/issues).

## How to install

1. Load the metadata block TSV as described in the [Dataverse documentation](https://guides.dataverse.org/en/latest/admin/metadatacustomization.html).
   1. Upload the TSV file.
  
      `
      curl $DATAVERSE_HOST/api/admin/datasetfield/load -H "Content-type: text/tab-separated-values" -X POST --upload-file related_datasets.tsv
      `

   2. Update the Solr schema.
2. Load the external controlled vocabulary configuration (it handles input and display of the related datasets) as described in the [Dataverse documentation](https://guides.dataverse.org/en/latest/admin/metadatacustomization.html#using-external-vocabulary-services).

   `
   curl $DATAVERSE_HOST/api/admin/settings/:CVocConf -X PUT --upload-file related_datasets_config.json
   `

## Credit

The external controlled vocabulary scripts in this repo have been based on [ror.js](https://github.com/gdcc/dataverse-external-vocab-support/blob/b5390e769815ce01fb59e3ac94220d28e565914d/scripts/ror.js) and [cvocutils.js](https://github.com/gdcc/dataverse-external-vocab-support/blob/c05446499ac4c912f5d3af798514561b2e27c3ab/scripts/cvocutils.js) provided in https://github.com/gdcc/dataverse-external-vocab-support.
