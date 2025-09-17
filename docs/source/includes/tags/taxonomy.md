### Parameters

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | Name of the element |
| toName | <code>string</code> |  | Name of the element that you want to classify |
| [apiUrl] | <code>string</code> |  | **Beta** -- Retrieve the taxonomy from a remote source. This can be a JSON-formatted file or a hierarchical data source read as an API. For more information, see the [Taxonomy template page](/templates/taxonomy) |
| [leafsOnly] | <code>boolean</code> | <code>false</code> | Allow annotators to select only leaf nodes of taxonomy |
| [showFullPath] | <code>boolean</code> | <code>false</code> | Whether to show the full path of selected items |
| [pathSeparator] | <code>string</code> | <code>&quot;/&quot;</code> | Separator to show in the full path (default is " / "). To avoid errors, ensure that your data does not include this separator |
| [maxUsages] | <code>number</code> |  | Maximum number of times a choice can be selected per task or per region |
| [maxWidth] | <code>number</code> |  | Maximum width for dropdown with units (eg: "500px") |
| [minWidth] | <code>number</code> |  | Minimum width for dropdown with units (eg: "300px") |
| [required] | <code>boolean</code> | <code>false</code> | Whether it is required to have selected at least one option |
| [requiredMessage] | <code>string</code> |  | Message to show if validation fails |
| [placeholder=] | <code>string</code> |  | What to display as prompt on the input |
| [perRegion] | <code>boolean</code> |  | Use this tag to classify specific regions instead of the whole object |
| [perItem] | <code>boolean</code> |  | Use this tag to classify specific items inside the object instead of the whole object |
| [labeling] | <code>boolean</code> |  | Use taxonomy to label regions in text. Only supported with `<Text>` and `<HyperText>` object tags. |
| [legacy] | <code>boolean</code> |  | Use this tag to enable the legacy version of the Taxonomy tag. The legacy version supports the ability for annotators to add labels as needed. However, when true, the `apiUrl` parameter is not usable. |

