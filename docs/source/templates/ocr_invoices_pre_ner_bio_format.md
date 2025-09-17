---
title: OCR Invoices Pre-NER BIO Format
type: templates
category: Community Contributions
cat: community
order: 1002
meta_title: OCR Invoices Pre-NER BIO Format Data Labeling Template
meta_description: Template for ocr invoices pre-ner bio format with Label Studio
community: true
community_author: redeipirati
community_contributors: carly-bartel
community_repo: awesome-label-studio-config
github_repo: humanSignal/awesome-label-studio-config
repo_url: https://github.com/HumanSignal/awesome-label-studio-config/tree/main/label-configs/ocr-invoices-pre-ner-bio-format
---


<img src="/images/templates/ocr-invoices-pre-ner-bio-format.jpg" alt="" class="gif-border" width="552px" height="408px" />

OCR text extraction and tokenization with BIO format for invoice documents. All tokens are initially tagged as 'O' (Outside) for subsequent NER tagging.

## Labeling Configuration

```html
<View>
  <!-- The image to annotate -->
  <Image name="image" value="$image" zoomControl="true"/>

  <!-- Bounding-box control that will receive the "rectanglelabels" results
       coming from your OCR model (from_name = "label") -->
  <RectangleLabels name="label" toName="image" choice="single">
    <!-- You only emit the generic "O" class, but feel free to add more labels -->
    <Label value="O" background="#FFA500"/>
  </RectangleLabels>

  <!-- Per-region transcription box (from_name = "transcription").
       Because perRegion="true", one TextArea is linked to each rectangle. -->
  <TextArea name="transcription"
            toName="image"
            perRegion="true"
            editable="true"
            rows="1"
            required="true"
            placeholder="Type or correct OCR text…"/>
</View>
```

## About the labeling configuration

All labeling configurations must be wrapped in [View](/tags/view.html) tags.

This configuration uses the following tags:

- [Image](/tags/image.html)
- [RectangleLabels](/tags/rectanglelabels.html)
- [TextArea](/tags/textarea.html)
- [View](/tags/view.html)

## Usage Instructions

This configuration provides a streamlined interface for OCR text verification and correction:

