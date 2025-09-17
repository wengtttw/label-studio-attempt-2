---
title: Image Classification
type: templates
category: Computer Vision
cat: computer-vision
order: 135
meta_title: Image Classification Data Labeling Template
meta_description: Template for classifying image data with Label Studio for your machine learning and data science projects.
---

<img src="/images/templates/image-classification.png" alt="" class="gif-border" width="552px" height="408px" />

If you want to train a model to identify the type of content in images, for example for a content moderation use case, use this template to perform image classification with checkboxes.

<a href="https://app.humansignal.com/b/MTk3"
  target="_blank" rel="noopener" aria-label="Open in Label Studio" style="all:unset;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;border:1px solid rgb(109,135,241);padding:8px 12px;background:rgb(87 108 193);color:white;font-weight:500;font-family:sans-serif;gap:6px;transition:background 0.2s ease;" onmouseover="this.style.background='rgb(97 122 218)'" onmouseout="this.style.background='rgb(87 108 193)'">
  <svg style="width:20px;height:20px" viewBox="0 0 26 26" fill="none"><path fill="none" d="M3.5 4.5h19v18h-19z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M25.7 7.503h-7.087V5.147H7.588V2.792h11.025V.436H25.7v7.067Zm-18.112 0H5.225v10.994H2.863V7.503H.5V.436h7.088v7.067Zm0 18.061v-7.067H.5v7.067h7.088ZM25.7 18.497v7.067h-7.088v-2.356H7.588v-2.355h11.025v-2.356H25.7Zm-2.363 0V7.503h-2.363v10.994h2.363Z" fill="white"/></svg>
  <span style="font-size:14px">Open in Label Studio</span>
  <svg style="width:16px;height:16px" viewBox="0 0 24 24"><path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" fill="white"/></svg>
</a>

## Interactive Template Preview

<div id="main-preview"></div>

## Labeling Configuration

```html
<View>
  <Image name="image" value="$image"/>
  <Choices name="choice" toName="image">
    <Choice value="Adult content"/>
    <Choice value="Weapons" />
    <Choice value="Violence" />
  </Choices>
</View>
```

## About the labeling configuration

All labeling configurations must be wrapped in [View](/tags/view.html) tags.

Use the [Image](/tags/image.html) object tag to specify the image to classify:
```xml
<Image name="image" value="$image"/>
```

Use the [Choices](/tags/choices.html) control tag to display the choices available to classify the image:
```xml
  <Choices name="choice" toName="image">
    <Choice value="Adult content"/>
    <Choice value="Weapons" />
    <Choice value="Violence" />
  </Choices>
```
You can modify the values of the [Choice](/tags/choice.html) tag to provide different classification options. Review the available arguments for the Choices tag for customization options. 

## Enhance this template

You can enhance this template in many ways.

### Add a sticky left column

If you want the classification choices to appear to the left of the image, you can add styling to the [View](/tags/view.html) tag. 

```xml
<View style="display: flex;">
  <View style="padding: 0em 1em; background: #f1f1f1; margin-right: 1em; border-radius: 3px">
    <View style="position: sticky; top: 0">
    <Choices name="choice" toName="image">
        <Choice value="Adult content"/>
        <Choice value="Weapons" />
        <Choice value="Violence" />
    </Choices>
    </View>
  </View>
    
  <View>
    <Image name="image" value="$image"/>
  </View>
</View>

```

{% insertmd includes/nested-classification.md %}

## Related tags

- [Image](/tags/image.html)
- [Choices](/tags/choices.html)
