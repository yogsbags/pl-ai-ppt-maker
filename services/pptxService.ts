
import pptxgen from "pptxgenjs";
import { Presentation } from "../types";

export const exportToPptx = async (presentation: Presentation) => {
  const pres = new pptxgen();
  
  // 1. Title Slide
  const titleSlide = pres.addSlide();
  titleSlide.background = { color: "0F172A" };
  
  titleSlide.addText(presentation.title, {
    x: 1, y: 1.5, w: 8, h: 2,
    fontSize: 44, color: "FFFFFF", bold: true, align: "center"
  });
  
  titleSlide.addText(presentation.subtitle, {
    x: 1, y: 3.5, w: 8, h: 1,
    fontSize: 24, color: "94A3B8", align: "center"
  });

  // 2. Content Slides
  for (const slideData of presentation.slides) {
    const slide = pres.addSlide();
    
    // Background image if exists
    if (slideData.imageUrl) {
      slide.background = { data: slideData.imageUrl };
      
      // Add a semi-transparent overlay box for text readability
      slide.addShape(pres.ShapeType.rect, {
        x: 0.5, y: 0.5, w: 9, h: 4.6,
        fill: { color: "000000", transparency: 40 }
      });
    } else {
      slide.background = { color: "1E293B" };
    }

    slide.addText(slideData.title, {
      x: 0.8, y: 0.8, w: 8.4, h: 1,
      fontSize: 32, color: "FFFFFF", bold: true
    });

    const bulletText = slideData.content.map(line => ({
      text: line,
      options: { bullet: true, fontSize: 18, color: "E2E8F0" }
    }));

    slide.addText(bulletText, {
      x: 0.8, y: 1.8, w: 8.4, h: 3,
      valign: "top"
    });
  }

  // 3. Save
  await pres.writeFile({ fileName: `${presentation.title.replace(/\s+/g, '_')}.pptx` });
};
