# My Portfolio Website

A simple, modern portfolio website to showcase your projects with photos and videos.

## Quick Start - Adding a New Project

1. **Add your media file** (image or video) to the `media/` folder

2. **Edit `projects.js`** and add a new project entry:

```javascript
{
    title: "My Project Name",
    description: "Brief description of your project",
    date: "January 2025",
    mediaType: "image", // Use "image" or "video"
    mediaSrc: "media/your-file.jpg", // Path to your media file
    tags: ["Tag1", "Tag2", "Tag3"]
}
```

3. **Save and refresh** - That's it! Your new project will appear on your portfolio.

## File Structure

```
.
├── index.html          # Main HTML file (no need to edit)
├── styles.css          # Styling (edit to customize colors/layout)
├── projects.js         # YOUR PROJECTS GO HERE - edit this file!
├── app.js             # Rendering logic (no need to edit)
├── media/             # Put your images and videos here
│   └── README.md      # Instructions for media files
└── README.md          # This file
```

## Customization

### Change Colors
Edit `styles.css` and modify the gradient in the header section:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### Change Title
Edit `index.html` and update:
```html
<h1>My Portfolio</h1>
<p class="tagline">Check out my latest projects</p>
```

## Supported Media Formats

**Images:** .jpg, .jpeg, .png, .gif, .webp
**Videos:** .mp4, .webm, .mov

## Publishing to GitHub Pages

1. Go to your repository settings on GitHub
2. Navigate to "Pages" section
3. Select your branch (usually `main` or `master`)
4. Click Save
5. Your portfolio will be live at `https://vortexcodes.github.io`

## Example Projects

The `projects.js` file comes with example projects. Feel free to delete them and add your own!

---

Built with simple HTML, CSS, and JavaScript - no build tools required!