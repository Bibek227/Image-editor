import { useState, useRef, useEffect, useCallback } from 'react'
import { removeBackground } from '@imgly/background-removal'
import './App.css'
import { Analytics } from "@vercel/analytics/react"
import Upscaler from 'upscaler'
const FONT_FAMILIES = [
  'Arial',
  'Times New Roman',
  'Helvetica',
  'Georgia',
  'Verdana',
  'Courier New',
  'Trebuchet MS',
  'Impact',
  'Comic Sans MS',
  'Palatino',
  'Garamond',
  'Bookman',
  'Tahoma',
  'Lucida Sans',
  'Arial Black',
  'Century Gothic',
  'Franklin Gothic Medium',
  'Copperplate',
  'Optima',
  'Candara',
  'Calibri',
  'Cambria',
  'Didot',
  'Futura',
  'Geneva',
  'Rockwell',
  'Segoe UI',
  'Baskerville',
  'Monaco',
  'Brush Script MT',
];

const resizeImage = (image, maxWidth = 800, maxHeight = 600) => {
  let width = image.width;
  let height = image.height;

  // Calculate aspect ratio
  const aspectRatio = width / height;

  // Resize based on the dimension that exceeds its maximum
  if (width > maxWidth || height > maxHeight) {
    if (width / maxWidth > height / maxHeight) {
      // Width is the constraining dimension
      width = maxWidth;
      height = width / aspectRatio;
    } else {
      // Height is the constraining dimension
      height = maxHeight;
      width = height * aspectRatio;
    }
  }

  return { width, height };
};

// Add initial photo edit values as a constant
const DEFAULT_PHOTO_EDITS = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: 0,
  rotate: 0,
  flipHorizontal: false,
  flipVertical: false,
  zoom: 100
};

function App() {
  const [originalImage, setOriginalImage] = useState(null)
  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [backgroundText, setBackgroundText] = useState('')
  const [textColor, setTextColor] = useState('#000000')
  const [fontSize, setFontSize] = useState(48)
  const [fontFamily, setFontFamily] = useState('Arial')
  const [textPosition, setTextPosition] = useState({ x: 50, y: 50 })
  const [isProcessing, setIsProcessing] = useState(false)
  const [showBackground, setShowBackground] = useState(true)
  const [isBackgroundRemoved, setIsBackgroundRemoved] = useState(false)
  const [processedImage, setProcessedImage] = useState(null)
  const canvasRef = useRef(null)
  const imageCache = useRef({
    original: null,
    processed: null
  });
  const [textStyle, setTextStyle] = useState({
    bold: false,
    italic: false,
    underline: false,
    uppercase: false,
    textShadow: false,
    letterSpacing: 0,
  });
  const [photoEdits, setPhotoEdits] = useState(DEFAULT_PHOTO_EDITS);
  const [enhancedImage, setEnhancedImage] = useState(null);
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Add reset function
  const resetPhotoEdits = () => {
    setPhotoEdits(DEFAULT_PHOTO_EDITS);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        imageCache.current = { original: null, processed: null };
        setOriginalImage(e.target.result)
        setIsBackgroundRemoved(false)
        setBackgroundText('');
        setTextStyle({
          bold: false,
          italic: false,
          underline: false,
          uppercase: false,
          textShadow: false,
          letterSpacing: 0,
        });
      }
      reader.readAsDataURL(file)
    }
  }

  const processImageBackground = async (imageUrl) => {
    if (!imageUrl) return
    
    setIsProcessing(true)
    try {
      const blob = await fetch(imageUrl).then(r => r.blob())
      const processedBlob = await removeBackground(blob, {
        model: 'medium',
        preprocessing: 'auto',
        postprocessing: 'auto',
        returnMask: false,
        skipConfidence: true,
      })
      const processedUrl = URL.createObjectURL(processedBlob)
      imageCache.current.processed = null;
      setProcessedImage(processedUrl)
      setIsBackgroundRemoved(true)
    } catch (error) {
      console.error('Error removing background:', error)
    }
    setIsProcessing(false)
  }

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert the canvas to a data URL
    const imageUrl = canvas.toDataURL('image/png', 1.0); // Use 'image/jpeg' for JPEG format, 1.0 for maximum quality

    // Create a link element to trigger the download
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'edited-image.png'; // Set the desired file name
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePhotoEdit = (type, value) => {
    setPhotoEdits(prev => ({ ...prev, [type]: value }));
  };

  const applyPhotoEdits = (ctx, width, height) => {
    ctx.filter = `brightness(${photoEdits.brightness}%) 
                  contrast(${photoEdits.contrast}%) 
                  saturate(${photoEdits.saturation}%) 
                  grayscale(${photoEdits.grayscale}%)`;

    // Apply transformations
    ctx.save();
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Move to center, rotate, flip, and move back
    ctx.translate(centerX, centerY);
    ctx.rotate((photoEdits.rotate * Math.PI) / 180);
    ctx.scale(
      photoEdits.flipHorizontal ? -1 : 1,
      photoEdits.flipVertical ? -1 : 1
    );
    ctx.translate(-centerX, -centerY);

    // Apply zoom
    const zoomFactor = photoEdits.zoom / 100;
    ctx.scale(zoomFactor, zoomFactor);
  };

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !originalImage) return;

    const ctx = canvas.getContext('2d');
    
    const loadImages = async () => {
      if (!imageCache.current.original) {
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = () => {
            imageCache.current.original = img;
            resolve();
          };
          img.src = originalImage;
        });
      }

      if (processedImage && !imageCache.current.processed) {
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = () => {
            imageCache.current.processed = img;
            resolve();
          };
          img.src = processedImage;
        });
      }
    };

    const drawText = (ctx, text, x, y) => {
      ctx.save();
      
      // Apply text shadow first if enabled
      if (textStyle.textShadow) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      // Build font string with styles
      const fontWeight = textStyle.bold ? 'bold' : 'normal';
      const fontStyle = textStyle.italic ? 'italic' : 'normal';
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = textColor; // Set text color
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Process text for uppercase if enabled
      const processedText = textStyle.uppercase ? text.toUpperCase() : text;
      
      // Draw text with letter spacing if enabled
      if (textStyle.letterSpacing > 0) {
        const letters = processedText.split('');
        let currentX = x - (letters.length * textStyle.letterSpacing) / 2;
        letters.forEach((letter) => {
          ctx.fillText(letter, currentX, y);
          currentX += ctx.measureText(letter).width + textStyle.letterSpacing;
        });
      } else {
        ctx.fillText(processedText, x, y);
      }

      // Add underline if enabled
      if (textStyle.underline) {
        const textMetrics = ctx.measureText(processedText);
        const lineY = y + fontSize/4;
        ctx.beginPath();
        ctx.moveTo(x - textMetrics.width / 2, lineY);
        ctx.lineTo(x + textMetrics.width / 2, lineY);
        ctx.strokeStyle = textColor; // Use same color for underline
        ctx.lineWidth = fontSize / 20;
        ctx.stroke();
      }
      
      ctx.restore();
    };

    const draw = () => {
      const originalImg = imageCache.current.original;
      if (!originalImg) return;

      const { width, height } = resizeImage(originalImg);
      
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      // Apply photo edits
      applyPhotoEdits(ctx, width, height);

      if (isBackgroundRemoved && imageCache.current.processed) {
        if (showBackground) {
          ctx.drawImage(originalImg, 0, 0, width, height);
          if (backgroundText) {
            drawText(ctx, backgroundText, width * textPosition.x / 100, height * textPosition.y / 100);
          }
          ctx.drawImage(imageCache.current.processed, 0, 0, width, height);
        } else {
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, width, height);
          if (backgroundText) {
            drawText(ctx, backgroundText, width * textPosition.x / 100, height * textPosition.y / 100);
          }
          ctx.drawImage(imageCache.current.processed, 0, 0, width, height);
        }
      } else {
        ctx.drawImage(originalImg, 0, 0, width, height);
        if (backgroundText) {
          drawText(ctx, backgroundText, width * textPosition.x / 100, height * textPosition.y / 100);
        }
      }

      ctx.restore(); // Restore after photo edits
    };

    loadImages().then(draw);
  }, [originalImage, processedImage, backgroundColor, backgroundText, textColor, 
      fontSize, fontFamily, textPosition, showBackground, isBackgroundRemoved, textStyle, photoEdits]);

  useEffect(() => {
    renderCanvas()
  }, [renderCanvas])

  // Clean up cached images on unmount
  useEffect(() => {
    return () => {
      imageCache.current = { original: null, processed: null };
    };
  }, []);

  return (
    <div className="image-editor">
      <main className="image-editor">
        <header className="editor-header">
          <h1 className="editor-title">Free Online Image Editor</h1>
          <p className="editor-subtitle">Remove background, add text behind images, and adjust photos easily</p>
          <div className="upload-section">
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageUpload} 
              id="file-input"
              className="file-input"
            />
            <label htmlFor="file-input" className="file-label">
              <span className="upload-icon">📁</span>
              {originalImage ? 'Change Image' : 'Upload Image'}
            </label>
          </div>
        </header>
        
        {originalImage && (
          <section className="editor-container">
            <div className="controls-panel">
              <div className="controls-wrapper">
                <div className="control-group compact">
                  <div className="group-header">
                    <h3>🎨 Photo Adjustments</h3>
                    <button 
                      onClick={resetPhotoEdits}
                      className="reset-btn"
                      title="Reset all adjustments"
                    >
                      ↺ Reset
                    </button>
                  </div>
                  <div className="photo-controls-grid">
                    <div className="range-control">
                      <span>
                        Brightness
                        <span className="range-value">{photoEdits.brightness}%</span>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={photoEdits.brightness}
                        onChange={(e) => handlePhotoEdit('brightness', Number(e.target.value))}
                      />
                    </div>

                    <div className="range-control">
                      <span>
                        Contrast
                        <span className="range-value">{photoEdits.contrast}%</span>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={photoEdits.contrast}
                        onChange={(e) => handlePhotoEdit('contrast', Number(e.target.value))}
                      />
                    </div>

                    <div className="range-control">
                      <span>
                        Saturation
                        <span className="range-value">{photoEdits.saturation}%</span>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={photoEdits.saturation}
                        onChange={(e) => handlePhotoEdit('saturation', Number(e.target.value))}
                      />
                    </div>

                    <div className="range-control">
                      <span>
                        Grayscale
                        <span className="range-value">{photoEdits.grayscale}%</span>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={photoEdits.grayscale}
                        onChange={(e) => handlePhotoEdit('grayscale', Number(e.target.value))}
                      />
                    </div>

                    <div className="range-control">
                      <span>
                        Rotate
                        <span className="range-value">{photoEdits.rotate}°</span>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={photoEdits.rotate}
                        onChange={(e) => handlePhotoEdit('rotate', Number(e.target.value))}
                      />
                    </div>

                    <div className="range-control">
                      <span>
                        Zoom
                        <span className="range-value">{photoEdits.zoom}%</span>
                      </span>
                      <input
                        type="range"
                        min="50"
                        max="200"
                        value={photoEdits.zoom}
                        onChange={(e) => handlePhotoEdit('zoom', Number(e.target.value))}
                      />
                    </div>

                    <div className="button-controls">
                      <button
                        className={`style-btn ${photoEdits.flipHorizontal ? 'active' : ''}`}
                        onClick={() => handlePhotoEdit('flipHorizontal', !photoEdits.flipHorizontal)}
                        title="Flip Horizontal"
                      >
                        ↔️
                      </button>
                      <button
                        className={`style-btn ${photoEdits.flipVertical ? 'active' : ''}`}
                        onClick={() => handlePhotoEdit('flipVertical', !photoEdits.flipVertical)}
                        title="Flip Vertical"
                      >
                        ↕️
                      </button>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => processImageBackground(originalImage)}
                  disabled={isProcessing}
                  className="remove-bg-btn"
                >
                  {isProcessing ? 'Processing...' : '🪄 Remove Background'}
                </button>

                {isBackgroundRemoved && (
                  <div className="control-group compact">
                    <h3>🎨 Background Settings</h3>
                    <div className="toggle-group">
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={showBackground}
                          onChange={(e) => setShowBackground(e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                      <span>{showBackground ? 'Original' : 'Custom'}</span>
                    </div>

                    {!showBackground && (
                      <div className="color-picker">
                        <label htmlFor="bg-color">Color:</label>
                        <div className="color-input-wrapper">
                          <input 
                            type="color" 
                            id="bg-color"
                            value={backgroundColor}
                            onChange={(e) => setBackgroundColor(e.target.value)}
                          />
                          <span className="color-value">{backgroundColor}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isBackgroundRemoved && (
                  <div className="control-group compact">
                    <h3>✏️ Text Settings</h3>
                    <div className="text-controls-grid">
                      <input 
                        type="text"
                        placeholder="Enter text..."
                        value={backgroundText}
                        onChange={(e) => setBackgroundText(e.target.value)}
                        className="text-input"
                      />
                      
                      <div className="text-style-controls">
                        <button
                          className={`style-btn ${textStyle.bold ? 'active' : ''}`}
                          onClick={() => setTextStyle(prev => ({ ...prev, bold: !prev.bold }))}
                          title="Bold"
                        >
                          B
                        </button>
                        <button
                          className={`style-btn ${textStyle.italic ? 'active' : ''}`}
                          onClick={() => setTextStyle(prev => ({ ...prev, italic: !prev.italic }))}
                          title="Italic"
                        >
                          I
                        </button>
                        <button
                          className={`style-btn ${textStyle.underline ? 'active' : ''}`}
                          onClick={() => setTextStyle(prev => ({ ...prev, underline: !prev.underline }))}
                          title="Underline"
                        >
                          U
                        </button>
                        <button
                          className={`style-btn ${textStyle.uppercase ? 'active' : ''}`}
                          onClick={() => setTextStyle(prev => ({ ...prev, uppercase: !prev.uppercase }))}
                          title="Uppercase"
                        >
                          AA
                        </button>
                        <button
                          className={`style-btn ${textStyle.textShadow ? 'active' : ''}`}
                          onClick={() => setTextStyle(prev => ({ ...prev, textShadow: !prev.textShadow }))}
                          title="Text Shadow"
                        >
                          S
                        </button>
                      </div>

                      <div className="letter-spacing-control">
                        <span>
                          Letter Spacing
                          <span className="range-value">{textStyle.letterSpacing}px</span>
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="20"
                          step="0.5"
                          value={textStyle.letterSpacing}
                          onChange={(e) => setTextStyle(prev => ({
                            ...prev,
                            letterSpacing: Number(e.target.value)
                          }))}
                        />
                      </div>

                      <div className="text-properties">
                        <select 
                          value={fontFamily}
                          onChange={(e) => setFontFamily(e.target.value)}
                          className="font-select"
                        >
                          {FONT_FAMILIES.map(font => (
                            <option 
                              key={font} 
                              value={font}
                              style={{ fontFamily: font }}
                            >
                              {font}
                            </option>
                          ))}
                        </select>

                        <div className="color-input-wrapper compact">
                          <input 
                            type="color"
                            value={textColor}
                            onChange={(e) => setTextColor(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="size-position-controls">
                        <div className="range-control">
                          <span>Size: {fontSize}px</span>
                          <input 
                            type="range"
                            value={fontSize}
                            onChange={(e) => setFontSize(Number(e.target.value))}
                            min="24"
                            max="200"
                            step="2"
                          />
                        </div>

                        <div className="position-controls">
                          <div className="range-control">
                            <span>X: {textPosition.x}%</span>
                            <input 
                              type="range"
                              value={textPosition.x}
                              onChange={(e) => setTextPosition(prev => ({
                                ...prev,
                                x: Number(e.target.value)
                              }))}
                              min="0"
                              max="100"
                            />
                          </div>
                          <div className="range-control">
                            <span>Y: {textPosition.y}%</span>
                            <input 
                              type="range"
                              value={textPosition.y}
                              onChange={(e) => setTextPosition(prev => ({
                                ...prev,
                                y: Number(e.target.value)
                              }))}
                              min="0"
                              max="100"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <button 
                  onClick={handleDownload}
                  className="download-btn"
                  disabled={isProcessing}
                >
                  💾 Download Image
                </button>
              </div>
            </div>

            <div className="preview-panel">
              <canvas ref={canvasRef} className="processed-image" />
            </div>
          </section>
        )}
        
        <footer className="editor-footer">
          <div className="footer-content">
            <p>Free online image editor - No signup required</p>
            <div className="footer-links">
              <a href="/about">About Us</a>
              <a href="/contact">Contact</a>
              <a href="/privacy">Privacy Policy</a>
            </div>
            <div className="social-media">
              <a href="https://twitter.com/yourprofile" target="_blank" rel="noopener noreferrer">
                <img src="/icons/twitter.svg" alt="Twitter" />
              </a>
              <a href="https://facebook.com/yourprofile" target="_blank" rel="noopener noreferrer">
                <img src="/icons/facebook.svg" alt="Facebook" />
              </a>
              <a href="https://instagram.com/yourprofile" target="_blank" rel="noopener noreferrer">
                <img src="/icons/instagram.svg" alt="Instagram" />
              </a>
            </div>
          </div>
          <p>© {new Date().getFullYear()} Your Image Editor</p>
        </footer>
      </main>
      <Analytics />
    </div>
  )
}

export default App
