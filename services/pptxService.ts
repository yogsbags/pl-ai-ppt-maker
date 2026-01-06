
import pptxgen from "pptxgenjs";
import { Presentation, Slide } from "../types";

export const exportToPptx = async (presentation: Presentation) => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  const primaryColor = presentation.branding?.primaryColor?.replace('#', '') || "6366F1";
  
  // 1. Title Slide
  const titleSlide = pres.addSlide();
  titleSlide.background = { color: "020617" };
  
  if (presentation.branding?.logoUrl) {
    titleSlide.addImage({
      path: presentation.branding.logoUrl,
      x: 4.5, y: 0.5, w: 1, h: 0.5,
      sizing: { type: 'contain' }
    });
  }

  titleSlide.addText(presentation.title, {
    x: 0, y: 0, w: '100%', h: '100%',
    fontSize: 48, color: "FFFFFF", bold: true, align: "center", valign: "middle",
    fontFace: "Arial"
  });
  
  titleSlide.addText(presentation.oneLiner || presentation.branding?.slogan || "", {
    x: 1, y: 5.5, w: 8, h: 0.5,
    fontSize: 16, color: primaryColor, bold: true, align: "center", fontFace: "Arial"
  });

  // 2. Content Slides
  for (const slideData of presentation.slides) {
    const slide = pres.addSlide();
    
    if (slideData.imageUrl) {
      slide.background = { data: slideData.imageUrl };
      slide.addShape(pres.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: '100%',
        fill: { color: "000000", transparency: 60 }
      });
    } else {
      slide.background = { color: "0F172A" };
    }

    if (presentation.branding?.logoUrl) {
      slide.addImage({
        path: presentation.branding.logoUrl,
        x: 9, y: 5.0, w: 0.8, h: 0.4,
        sizing: { type: 'contain' }
      });
    }

    // Title
    slide.addText(slideData.title, {
      x: 0.5, y: 0.5, w: 9, h: 1,
      fontSize: 32, color: "FFFFFF", bold: true, align: "left", fontFace: "Arial"
    });

    // Content Handling based on componentType
    if (slideData.componentType === 'chart' && slideData.chartData) {
      const labels = slideData.chartData.map(d => d.label);
      const values = slideData.chartData.map(d => d.value);
      slide.addChart(pres.ChartType.bar, [
        { name: "Value", labels, values }
      ], {
        x: 0.5, y: 1.5, w: 9, h: 4,
        showLegend: false,
        chartColors: [primaryColor],
        valAxisTitleColor: "FFFFFF",
        catAxisLabelColor: "FFFFFF"
      });
    } else if (slideData.componentType === 'table' && slideData.tableData) {
      const tableRows = [
        slideData.tableData.headers.map(h => ({ text: h, options: { bold: true, fill: primaryColor, color: "FFFFFF" } })),
        ...slideData.tableData.rows
      ];
      slide.addTable(tableRows as any, {
        x: 0.5, y: 1.5, w: 9,
        border: { pt: 1, color: "334155" },
        color: "FFFFFF",
        fontSize: 12
      });
    } else {
      // Default bullet list
      const bulletText = slideData.content.map(line => ({
        text: line,
        options: { bullet: true, fontSize: 18, color: "E2E8F0", fontFace: "Arial", margin: 10 }
      }));

      slide.addText(bulletText, {
        x: 0.5, y: 1.5, w: 9, h: 4,
        valign: "top"
      });
    }
  }

  await pres.writeFile({ fileName: `${presentation.title.replace(/\s+/g, '_')}.pptx` });
};
