---
title: NER Tagging for Invoices (BIO Format)
type: templates
category: Community Contributions
cat: community
order: 1001
meta_title: NER Tagging for Invoices (BIO Format) Data Labeling Template
meta_description: Template for ner tagging for invoices (bio format) with Label Studio
community: true
community_author: redeipirati
community_contributors: carly-bartel
community_repo: awesome-label-studio-config
github_repo: humanSignal/awesome-label-studio-config
repo_url: https://github.com/HumanSignal/awesome-label-studio-config/tree/main/label-configs/ner-tagging-invoices-bio-format
---


<img src="/images/templates/ner-tagging-invoices-bio-format.jpg" alt="" class="gif-border" width="552px" height="408px" />

This labeling config enables Named Entity Recognition (NER) on invoice documents using the BIO (Beginning, Inside, Outside) format. It combines OCR text recognition with entity tagging for key invoice elements.

## Labeling Configuration

```html
<View style="display: flex; align-items: flex-start; gap: 1em;">
  <!-- Left panel: labels + filter -->
  <View style="min-width: 250px; padding: 0.5em; background: #f7f7f7; border-radius: 4px;">
    <Header value="NER Tags" />
    <Labels name="ner" toName="text" showInline="false">
      <Label value="B-NIF"    background="#FF5733" />
      <Label value="B-FORN"   background="#33FF57" />
      <Label value="B-DATA"   background="#3375FF" />
      <Label value="B-VALOR"  background="#FF33A1" />
      <Label value="B-NUMFAT" background="#F3FF33" />
      <Label value="I-NIF"    background="#FF5733" />
      <Label value="I-FORN"   background="#33FF57" />
      <Label value="I-DATA"   background="#3375FF" />
      <Label value="I-VALOR"  background="#FF33A1" />
      <Label value="I-NUMFAT" background="#F3FF33" />
      <Label value="O"        background="#aaa"    />
    </Labels>
  </View>

  <!-- Right panel: text to annotate -->
  <View style="flex: 1; max-height: 80vh; overflow-y: auto;">
    <Text
      name="text"
      value="$ocr"
      granularity="word"
    />
  </View>
</View>
```

## About the labeling configuration

All labeling configurations must be wrapped in [View](/tags/view.html) tags.

This configuration uses the following tags:

- [Image](/tags/image.html)
- [TextArea](/tags/textarea.html)
- [Labels](/tags/labels.html)
- [View](/tags/view.html)

## Usage Instructions

- **Text**:  Text showing the recognized text from the invoice.
- **BIO Format Labels**: 
  - B- prefix: Beginning of an entity
  - I- prefix: Inside/continuation of an entity
  - O: Outside/not part of any entity
- **Entity Types**:
  - NIF: Tax identification number
  - FORN: Supplier information
  - DATA: Date information
  - VALOR: Amount/Value
  - NUMFAT: Invoice number

