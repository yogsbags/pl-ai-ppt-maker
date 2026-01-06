
import pptxgen from "pptxgenjs";
import { Presentation } from "../types";

export const exportToPptx = async (presentation: Presentation) => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  
  // 1. Title Slide
  const titleSlide = pres.addSlide();
  titleSlide.background = { color: "020617" };
  
  titleSlide.addText(presentation.title, {
    x: 0, y: 0, w: '100%', h: '100%',
    fontSize: 48, color: "FFFFFF", bold: true, align: "center", valign: "middle",
    fontFace: "Arial"
  });
  
  titleSlide.addText(presentation.subtitle, {
    x: 1, y: 4.5, w: 8, h: 1,
    fontSize: 24, color: "6366F1", align: "center", fontFace: "Arial"
  });

  // 2. Content Slides
  for (const slideData of presentation.slides) {
    const slide = pres.addSlide();
    
    if (slideData.imageUrl) {
      slide.background = { data: slideData.imageUrl };
      
      // Semi-transparent mask for readability
      slide.addShape(pres.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: '100%',
        fill: { color: "000000", transparency: 50 }
      });
    } else {
      slide.background = { color: "0F172A" };
    }

    const isSplit = slideData.layout === 'split';
    const isHero = slideData.layout === 'hero';

    slide.addText(slideData.title, {
      x: isHero ? 0.5 : 0.8, 
      y: isHero ? 1.5 : 0.6, 
      w: isSplit ? 4.5 : 8.4, 
      h: 1,
      fontSize: isHero ? 44 : 32, 
      color: "FFFFFF", 
      bold: true,
      align: isHero ? "center" : "left",
      fontFace: "Arial"
    });

    const bulletText = slideData.content.map(line => ({
      text: line,
      options: { bullet: true, fontSize: isHero ? 22 : 18, color: "E2E8F0", fontFace: "Arial" }
    }));

    slide.addText(bulletText, {
      x: isHero ? 0.5 : 0.8, 
      y: isHero ? 2.5 : 1.6, 
      w: isSplit ? 4.5 : 8.4, 
      h: 3.5,
      valign: "top",
      align: isHero ? "center" : "left"
    });
  }

  await pres.writeFile({ fileName: `${presentation.title.replace(/\s+/g, '_')}.pptx` });
};
