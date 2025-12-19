# Media Folder

Place your project images and videos in this folder.

## Supported Formats

**Images:**
- .jpg / .jpeg
- .png
- .gif
- .webp

**Videos:**
- .mp4 (recommended)
- .webm
- .mov

## How to Add Media

1. Copy your image or video file into this `media` folder
2. Note the filename (e.g., `my-project.jpg`)
3. Open `projects.js` in the root folder
4. Add a new project entry with your media file:

```javascript
{
    title: "My Awesome Project",
    description: "Description of what I built",
    date: "January 2025",
    mediaType: "image", // or "video"
    mediaSrc: "media/my-project.jpg", // your filename here
    tags: ["Tag1", "Tag2"]
}
```

That's it! Refresh your portfolio page to see the new project.
