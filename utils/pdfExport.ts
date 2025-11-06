import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Project, LogSheet } from '@/types';

// Web-compatible PDF generation
const generatePDFWeb = async (htmlContent: string, filename: string): Promise<boolean> => {
  try {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) return false;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${filename}</title>
          <style>
            @page {
              size: landscape;
              margin: 15mm;
            }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              font-size: 11px;
              line-height: 1.3;
            }
            .page { 
              page-break-after: always; 
              margin-bottom: 40px; 
            }
            .page:last-child { 
              page-break-after: avoid; 
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 15px 0; 
              font-size: 11px;
            }
            th, td { 
              border: 1px solid #333; 
              padding: 4px 6px; 
              text-align: center; 
              vertical-align: middle;
            }
            td:empty::before {
              content: "-";
            }
            th { 
              background-color: #f0f0f0; 
              font-weight: bold; 
              text-align: center;
            }
            h1 { 
              color: #000; 
              border-bottom: 3px solid #000; 
              padding-bottom: 10px; 
              margin-bottom: 20px;
              font-size: 24px;
            }
            h2 { 
              color: #333; 
              margin-top: 25px; 
              margin-bottom: 15px;
              font-size: 18px;
              border-bottom: 1px solid #ccc;
              padding-bottom: 5px;
            }
            .project-header { 
              background: #f9f9f9; 
              padding: 15px; 
              border: 2px solid #333;
              margin-bottom: 25px; 
              text-align: center;
            }
            .project-title {
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .project-info {
              display: flex;
              justify-content: space-between;
              margin-top: 10px;
            }
            .personnel-info {
              margin-top: 10px;
              text-align: left;
            }
            .personnel-info div {
              margin-bottom: 4px;
            }
            .page-number {
              position: fixed;
              bottom: 10mm;
              right: 15mm;
              font-size: 10px;
              color: #666;
            }
            .scene-header {
              background: #e8e8e8;
              padding: 8px;
              margin: 20px 0 10px 0;
              border: 1px solid #333;
              font-weight: bold;
              text-align: center;
            }
            .take-row:nth-child(even) {
              background-color: #f9f9f9;
            }
            .field-label {
              font-weight: bold;
              min-width: 80px;
            }
            .notes-cell {
              max-width: 200px;
              word-wrap: break-word;
            }
            .page-break { page-break-before: always; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Wait a bit for content to load, then trigger print dialog
    setTimeout(() => {
      printWindow.print();
    }, 500);
    
    return true;
  } catch (error) {
    console.error('Web PDF generation error:', error);
    return false;
  }
};

// Mobile PDF generation using HTML to PDF
const generatePDFMobile = async (htmlContent: string, filename: string): Promise<boolean> => {
  try {
    // Import legacy FileSystem API to avoid deprecation warnings
    const FileSystemLegacy = require('expo-file-system/legacy');
    
    // For mobile, we'll create an HTML file and let the user share it
    // In a real implementation, you'd use react-native-html-to-pdf or similar
    const htmlUri = `${FileSystemLegacy.documentDirectory}${filename}.html`;
    
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${filename}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 15px; 
              font-size: 10px;
              line-height: 1.2;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 15px 0; 
              font-size: 10px;
            }
            th, td { 
              border: 1px solid #333; 
              padding: 3px 5px; 
              text-align: center; 
              vertical-align: middle;
              word-wrap: break-word;
            }
            td:empty::before {
              content: "-";
            }
            th { 
              background-color: #f0f0f0; 
              font-weight: bold; 
              text-align: center;
            }
            h1 { 
              color: #000; 
              border-bottom: 3px solid #000; 
              padding-bottom: 8px; 
              margin-bottom: 15px;
              font-size: 20px;
            }
            h2 { 
              color: #333; 
              margin-top: 20px; 
              margin-bottom: 10px;
              font-size: 16px;
              border-bottom: 1px solid #ccc;
              padding-bottom: 3px;
            }
            .project-header { 
              background: #f9f9f9; 
              padding: 12px; 
              border: 2px solid #333;
              margin-bottom: 20px; 
              text-align: center;
            }
            .project-title {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 8px;
            }
            .project-info {
              font-size: 10px;
              margin-top: 8px;
            }
            .personnel-info {
              font-size: 10px;
              margin-top: 8px;
              text-align: left;
            }
            .personnel-info div {
              margin-bottom: 4px;
            }
            .page-number {
              position: fixed;
              bottom: 10mm;
              right: 15mm;
              font-size: 10px;
              color: #666;
            }
            .scene-header {
              background: #e8e8e8;
              padding: 6px;
              margin: 15px 0 8px 0;
              border: 1px solid #333;
              font-weight: bold;
              text-align: center;
              font-size: 12px;
            }
            .take-row:nth-child(even) {
              background-color: #f9f9f9;
            }
            .notes-cell {
              max-width: 150px;
              word-wrap: break-word;
            }
            .empty-state {
              text-align: center;
              color: #666;
              font-style: italic;
              padding: 20px;
            }
            .page-break { page-break-before: always; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;
    
    await FileSystemLegacy.writeAsStringAsync(htmlUri, fullHtml);
    
    // Share the HTML file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(htmlUri, {
        mimeType: 'text/html',
        dialogTitle: `Share ${filename}`,
      });
    }
    
    return true;
  } catch (error) {
    console.error('Mobile PDF generation error:', error);
    return false;
  }
};

const formatFieldName = (fieldId: string, customFields: string[] = []): string => {
  const fieldNames: Record<string, string> = {
    sceneNumber: 'Scene',
    shotNumber: 'Shot',
    takeNumber: 'Take',
    cameraFile: 'Camera File',
    cameraFile1: 'Camera 1',
    cameraFile2: 'Camera 2',
    cameraFile3: 'Camera 3',
    cameraFile4: 'Camera 4',
    cameraFile5: 'Camera 5',
    soundFile: 'Sound File',
    episodes: 'Episode',
    descriptionOfShot: 'Description',
    notesForTake: 'Notes',
  };

  // Handle custom fields with proper names
  if (fieldId.startsWith('custom_')) {
    const customIndex = parseInt(fieldId.replace('custom_', ''));
    if (customFields[customIndex]) {
      return customFields[customIndex];
    }
    return `Custom ${customIndex + 1}`;
  }

  // Handle multi-camera files
  if (fieldId.startsWith('cameraFile') && fieldId.length > 10) {
    const cameraNum = fieldId.replace('cameraFile', '');
    return `Camera ${cameraNum}`;
  }

  return fieldNames[fieldId] || fieldId;
};

const getFieldValue = (take: LogSheet, fieldId: string): string => {
  const data = take.data;
  if (!data) return '-';
  
  // Handle sound file ranges
  if (fieldId === 'soundFile') {
    if (data.sound_from && data.sound_to) {
      return `${data.sound_from}-${data.sound_to}`;
    }
    return data.soundFile || '-';
  }
  
  // Handle camera file ranges
  if (fieldId.startsWith('cameraFile')) {
    const cameraNum = fieldId === 'cameraFile' ? 1 : parseInt(fieldId.replace('cameraFile', ''));
    if (data[`camera${cameraNum}_from`] && data[`camera${cameraNum}_to`]) {
      return `${data[`camera${cameraNum}_from`]}-${data[`camera${cameraNum}_to`]}`;
    }
    return data[fieldId] || '-';
  }
  
  // Return value or dash for empty fields
  return data[fieldId] || '-';
};

const buildNotesWithClassifications = (take: LogSheet): string => {
  const data = take.data;
  const parts: string[] = [];
  
  // Add existing notes
  if (data?.notesForTake && data.notesForTake.trim()) {
    parts.push(data.notesForTake.trim());
  }
  
  // Add shot details
  if (data?.shotDetails && Array.isArray(data.shotDetails) && data.shotDetails.length > 0) {
    parts.push(data.shotDetails.join(', '));
  }
  
  // Add classification
  if (data?.classification) {
    parts.push(data.classification);
  }
  
  return parts.length > 0 ? parts.join(' - ') : '-';
};

const generateSmartExportSections = (
  logSheets: LogSheet[],
  fieldList: string[],
  customFields: string[]
): string => {
  const goodTakes = logSheets.filter(sheet => sheet.data?.isGoodTake && sheet.data?.sceneNumber);
  const inserts = logSheets.filter(sheet => sheet.data?.classification === 'Insert' && sheet.data?.sceneNumber);
  const wastes = logSheets.filter(sheet => sheet.data?.classification === 'Waste' && sheet.data?.sceneNumber);
  const ambiences = logSheets.filter(sheet => sheet.data?.classification === 'Ambience');
  const sfxs = logSheets.filter(sheet => sheet.data?.classification === 'SFX');
  
  const generateSectionTable = (title: string, takes: LogSheet[]) => {
    if (takes.length === 0) return '';
    
    const tableHeaders = fieldList.map(fieldId => 
      `<th>${formatFieldName(fieldId, customFields)}</th>`
    ).join('');
    
    const tableRows = takes.map(take => {
      const cells = fieldList.map(fieldId => {
        const cls = take.data?.classification;
        const isAmbOrSfx = cls === 'Ambience' || cls === 'SFX';
        let value: string;
        
        // Clear scene/shot/take for Ambience/SFX
        if (isAmbOrSfx && (fieldId === 'sceneNumber' || fieldId === 'shotNumber' || fieldId === 'takeNumber')) {
          value = '-';
        } else if (fieldId === 'notesForTake') {
          // Build notes with classifications
          value = buildNotesWithClassifications(take);
        } else {
          // Get field value (handles ranges)
          value = getFieldValue(take, fieldId);
        }
        
        const cellClass = (fieldId === 'notesForTake' || fieldId === 'descriptionOfShot') ? 'notes-cell' : '';
        return `<td class="${cellClass}">${value}</td>`;
      }).join('');
      return `<tr class="take-row">${cells}</tr>`;
    }).join('');
    
    return `
      <h2>${title} (${takes.length} takes)</h2>
      <table>
        <thead>
          <tr>${tableHeaders}</tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;
  };
  
  return [
    generateSectionTable('Good Takes', goodTakes),
    generateSectionTable('Inserts', inserts),
    generateSectionTable('Wastes', wastes),
    generateSectionTable('Ambiences', ambiences),
    generateSectionTable('SFX', sfxs)
  ].filter(Boolean).join('');
};

const generateFilmLogHTML = (
  project: Project,
  logSheets: LogSheet[],
  isSmartExport: boolean = false
): string => {
  // Get enabled fields from project settings
  const enabledFields = project.settings?.logSheetFields || [];
  const customFields = project.settings?.customFields || [];
  const cameraConfiguration = project.settings?.cameraConfiguration || 1;

  // Build field list
  const fieldList: string[] = [];
  
  enabledFields.forEach(field => {
    if (field.enabled) {
      if (field.id === 'cameraFile') {
        // Handle camera files based on configuration
        for (let i = 1; i <= cameraConfiguration; i++) {
          fieldList.push(cameraConfiguration === 1 ? 'cameraFile' : `cameraFile${i}`);
        }
      } else {
        fieldList.push(field.id);
      }
    }
  });

  // Add custom fields
  customFields.forEach((_, index) => {
    fieldList.push(`custom_${index}`);
  });

  // Group takes by scene and shot
  const takesByScene: Record<string, Record<string, LogSheet[]>> = {};
  const sfxTakes: LogSheet[] = [];
  const ambienceTakes: LogSheet[] = [];
  
  logSheets.forEach(logSheet => {
    const scene = logSheet.data?.sceneNumber;
    const shot = logSheet.data?.shotNumber;
    const classification = logSheet.data?.classification;
    
    // Skip takes without scene number in smart export mode
    if (isSmartExport && !scene) {
      return;
    }
    
    // In regular export, separate SFX and Ambiences without scene numbers
    if (!isSmartExport && !scene) {
      if (classification === 'SFX') {
        sfxTakes.push(logSheet);
        return;
      } else if (classification === 'Ambience') {
        ambienceTakes.push(logSheet);
        return;
      }
    }
    
    const sceneKey = scene || 'Unknown';
    const shotKey = shot || 'Unknown';
    
    if (!takesByScene[sceneKey]) {
      takesByScene[sceneKey] = {};
    }
    if (!takesByScene[sceneKey][shotKey]) {
      takesByScene[sceneKey][shotKey] = [];
    }
    
    takesByScene[sceneKey][shotKey].push(logSheet);
  });

  // Sort scenes and shots
  const sortedScenes = Object.keys(takesByScene).sort((a, b) => {
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  // Generate project header with personnel info
  const projectHeader = `
    <div class="project-header">
      <div class="project-title">${project.name}</div>
      <div>FILM PRODUCTION LOG SHEET</div>
      <div class="project-info">
        <div>Created: ${new Date(project.createdAt).toLocaleDateString()}</div>
        <div>Total Takes: ${logSheets.length}</div>
        <div>Export Date: ${new Date().toLocaleDateString()}</div>
      </div>
      ${project.settings?.directorName || project.settings?.cinematographerName || project.settings?.loggerName ? `
        <div class="personnel-info">
          ${project.settings?.directorName ? `<div><strong>Director:</strong> ${project.settings.directorName}</div>` : ''}
          ${project.settings?.cinematographerName ? `<div><strong>Cinematographer:</strong> ${project.settings.cinematographerName}</div>` : ''}
          ${project.settings?.loggerName ? `<div><strong>Logger:</strong> ${project.settings.loggerName}</div>` : ''}
        </div>
      ` : ''}
    </div>
  `;

  if (logSheets.length === 0) {
    return projectHeader + `
      <div class="empty-state">
        No takes have been logged for this project yet.
      </div>
    `;
  }

  // Generate table headers
  const tableHeaders = fieldList.map(fieldId => 
    `<th>${formatFieldName(fieldId, customFields)}</th>`
  ).join('');

  // Generate content for each scene
  let sceneContent = '';
  
  sortedScenes.forEach(scene => {
    const shots = takesByScene[scene];
    const sortedShots = Object.keys(shots).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return a.localeCompare(b, undefined, { numeric: true });
    });

    sceneContent += `<div class="scene-header">${scene}</div>`;
    
    sortedShots.forEach(shot => {
      const takes = shots[shot];
      
      // Sort takes by take number
      takes.sort((a, b) => {
        const takeA = parseInt(a.data?.takeNumber) || 0;
        const takeB = parseInt(b.data?.takeNumber) || 0;
        return takeA - takeB;
      });
      
      sceneContent += `
        <h2>${shot}</h2>
        <table>
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>
      `;
      
      takes.forEach((take, index) => {
        const cells = fieldList.map(fieldId => {
          let value: string;
          
          if (fieldId === 'notesForTake') {
            // Build notes with classifications
            value = buildNotesWithClassifications(take);
          } else {
            // Get field value (handles ranges)
            value = getFieldValue(take, fieldId);
          }
          
          // Handle notes and description fields with special formatting
          const cellClass = (fieldId === 'notesForTake' || fieldId === 'descriptionOfShot') ? 'notes-cell' : '';
          
          return `<td class="${cellClass}">${value}</td>`;
        }).join('');
        
        sceneContent += `<tr class="take-row">${cells}</tr>`;
      });
      
      sceneContent += `
          </tbody>
        </table>
      `;
    });
  });

  let content = projectHeader + sceneContent;
  
  // Add smart export sections if requested
  if (isSmartExport) {
    const smartSections = generateSmartExportSections(logSheets, fieldList, customFields);
    content += `\n<div class=\"page-break\"></div>\n<div>\n  ${smartSections}\n</div>`;
  } else {
    // Add SFX and Ambience tables for regular export
    if (sfxTakes.length > 0) {
      content += `
        <div class="scene-header">SFX</div>
        <table>
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>
      `;
      
      sfxTakes.forEach(take => {
        const cells = fieldList.map(fieldId => {
          let value: string;
          
          // Clear scene, shot, take for SFX
          if (fieldId === 'sceneNumber' || fieldId === 'shotNumber' || fieldId === 'takeNumber') {
            value = '-';
          } else if (fieldId === 'notesForTake') {
            // Build notes with classifications
            value = buildNotesWithClassifications(take);
          } else {
            // Get field value (handles ranges)
            value = getFieldValue(take, fieldId);
          }
          
          const cellClass = (fieldId === 'notesForTake' || fieldId === 'descriptionOfShot') ? 'notes-cell' : '';
          return `<td class="${cellClass}">${value}</td>`;
        }).join('');
        content += `<tr class="take-row">${cells}</tr>`;
      });
      
      content += `
          </tbody>
        </table>
      `;
    }
    
    if (ambienceTakes.length > 0) {
      content += `
        <div class="scene-header">Ambiences</div>
        <table>
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>
      `;
      
      ambienceTakes.forEach(take => {
        const cells = fieldList.map(fieldId => {
          let value: string;
          
          // Clear scene, shot, take for Ambiences
          if (fieldId === 'sceneNumber' || fieldId === 'shotNumber' || fieldId === 'takeNumber') {
            value = '-';
          } else if (fieldId === 'notesForTake') {
            // Build notes with classifications
            value = buildNotesWithClassifications(take);
          } else {
            // Get field value (handles ranges)
            value = getFieldValue(take, fieldId);
          }
          
          const cellClass = (fieldId === 'notesForTake' || fieldId === 'descriptionOfShot') ? 'notes-cell' : '';
          return `<td class="${cellClass}">${value}</td>`;
        }).join('');
        content += `<tr class="take-row">${cells}</tr>`;
      });
      
      content += `
          </tbody>
        </table>
      `;
    }
  }
  
  // Add page numbers
  content += `
    <div class="page-number">Page 1</div>
  `;
  
  return content;
};

export const exportProjectToPDF = async (
  project: Project,
  logSheets: LogSheet[],
  isSmartExport: boolean = false
): Promise<boolean> => {
  try {
    const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_FilmLog`;
    
    // Generate film log HTML content
    const fullContent = generateFilmLogHTML(project, logSheets, isSmartExport);

    // Generate PDF based on platform
    if (Platform.OS === 'web') {
      return await generatePDFWeb(fullContent, filename);
    } else {
      return await generatePDFMobile(fullContent, filename);
    }
  } catch (error) {
    console.error('PDF export error:', error);
    return false;
  }
};