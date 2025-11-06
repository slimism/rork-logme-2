# LogME

**Professional Take Logging Application for Film Production**

Developed by **Cubiq-Solutions** for LogME

---

## Description

LogME is a professional mobile application designed for film production crews to efficiently manage projects and log takes during production. The app provides a comprehensive solution for tracking camera files, sound files, scene numbers, shot numbers, and take numbers, ensuring accurate record-keeping throughout the filmmaking process.

Whether you're working on a small independent project or a large-scale production, LogME helps you maintain organized, detailed logs that can be exported to PDF for distribution to your production team.

---

## How It Works

### Core Functionality

#### 1. **Project Management**
- Create and manage multiple film projects
- Customize project settings including camera configuration (single or multi-camera setups)
- Organize logs by project with easy navigation

#### 2. **Take Logging**
- Log individual takes with comprehensive information:
  - Scene, Shot, and Take numbers
  - Camera file numbers (supports single values or ranges)
  - Sound file numbers (supports single values or ranges)
  - Shot descriptions and notes
  - Classification (Regular, Waste, Insert, Ambience, SFX)
  - Good/Bad take indicators
- Support for multi-camera configurations (up to 10 cameras)
- Range mode for logging multiple file numbers at once

#### 3. **Smart Duplicate Detection**
- Automatically detects duplicate file numbers or take numbers
- Offers "Insert Before" functionality to insert new takes before existing duplicates
- Intelligent file number shifting to maintain sequential numbering
- Handles conflicts between camera and sound files

#### 4. **Insert Before Feature**
- When a duplicate is detected, you can choose to insert the new take before the existing one
- Automatically shifts subsequent file numbers to maintain proper sequencing
- Updates take numbers for logs in the same scene/shot
- Works for both adding new takes and editing existing takes

#### 5. **File Number Management**
- Sequential file number shifting when inserting takes
- Automatic calculation of file number ranges
- Support for waste fields (blank camera or sound files)
- Maintains proper ordering across all logs

#### 6. **Smart Filtering**
- Filter logs by scene, shot, or take number
- Search functionality for quick access to specific logs
- View logs by classification type

#### 7. **PDF Export**
- Export project logs to PDF format
- Multiple template options:
  - Camera Log
  - Sound Log
  - Continuity Log
  - Shot List
  - Script Notes
- Professional formatting suitable for production distribution

#### 8. **Customizable Fields**
- Enable or disable specific fields per project
- Custom field support for project-specific requirements
- Flexible configuration to match your production needs

#### 9. **Multi-Camera Support**
- Configure projects for single or multi-camera setups
- Individual camera file tracking for each camera
- REC state management for active/inactive cameras
- Synchronized range mode across all cameras

### Technical Features

- **State Management**: Uses Zustand for efficient state management
- **Data Persistence**: Local storage with AsyncStorage
- **Token System**: Monetization through token-based unlocks
- **Trial Mode**: 15 free logs per trial project
- **Cross-Platform**: Built with React Native and Expo for iOS and Android

---

## Key Workflows

### Adding a New Take
1. Select or create a project
2. Fill in take information (scene, shot, take numbers, file numbers)
3. If duplicates are detected, choose to:
   - Insert before the duplicate (shifts subsequent files automatically)
   - Cancel and adjust file numbers manually
4. Save the take

### Editing an Existing Take
1. Open the take from the project view
2. Modify any fields as needed
3. If editing creates a duplicate, you can:
   - Insert before the duplicate (moves the take and shifts files)
   - Save normally (if no conflicts)
4. Changes are automatically saved

### Exporting Logs
1. Navigate to the project
2. Select the export option
3. Choose a template (Camera Log, Sound Log, etc.)
4. Generate and share the PDF

---

## Development

This application is built with:
- **React Native** with **Expo**
- **TypeScript** for type safety
- **Zustand** for state management
- **React Navigation** for routing
- **Expo Router** for file-based routing

---

## License

Developed by **Cubiq-Solutions** for LogME

---

## Support

For issues, questions, or feature requests, please contact the development team at Cubiq-Solutions.
