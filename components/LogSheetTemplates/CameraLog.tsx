import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button } from '@/components/Button';
import { Table, TableColumn, TableRow } from '@/components/Table';
import { CameraLogData } from '@/types';
import { useProjectStore } from '@/store/projectStore';

interface CameraLogProps {
  logSheetId: string;
  initialData?: CameraLogData;
  onSave?: () => void;
}

interface CameraLogRow {
  id: string;
  scene: string;
  take: string;
  shot: string;
  lens: string;
  aperture: string;
  iso: string;
  frameRate: string;
  notes: string;
}

export const CameraLog: React.FC<CameraLogProps> = ({ 
  logSheetId, 
  initialData,
  onSave
}) => {
  const { updateLogSheet } = useProjectStore();
  
  const [rows, setRows] = useState<CameraLogRow[]>(() => {
    if (initialData && (initialData as any).rows) {
      return (initialData as any).rows;
    }
    return [
      {
        id: '1',
        scene: '',
        take: '',
        shot: '',
        lens: '',
        aperture: '',
        iso: '',
        frameRate: '',
        notes: '',
      }
    ];
  });

  const columns: TableColumn[] = [
    { key: 'scene', title: 'Scene', width: 80, editable: true },
    { key: 'take', title: 'Take', width: 70, editable: true, type: 'number' },
    { key: 'shot', title: 'Shot', width: 100, editable: true },
    { key: 'lens', title: 'Lens', width: 90, editable: true },
    { key: 'aperture', title: 'Aperture', width: 90, editable: true },
    { key: 'iso', title: 'ISO', width: 70, editable: true, type: 'number' },
    { key: 'frameRate', title: 'Frame Rate', width: 100, editable: true },
    { key: 'notes', title: 'Notes', width: 150, editable: true, type: 'multiline' },
  ];

  const handleCellChange = (rowId: string, columnKey: string, value: string) => {
    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, [columnKey]: value } : row
    ));
  };

  const handleAddRow = () => {
    const newRow: CameraLogRow = {
      id: Date.now().toString(),
      scene: '',
      take: '',
      shot: '',
      lens: '',
      aperture: '',
      iso: '',
      frameRate: '',
      notes: '',
    };
    setRows(prev => [...prev, newRow]);
  };

  const handleDeleteRow = (rowId: string) => {
    if (rows.length > 1) {
      setRows(prev => prev.filter(row => row.id !== rowId));
    }
  };

  const handleSave = () => {
    updateLogSheet(logSheetId, { rows });
    if (onSave) onSave();
  };

  return (
    <View style={styles.container}>
      <Table
        columns={columns}
        data={rows}
        onCellChange={handleCellChange}
        onAddRow={handleAddRow}
        onDeleteRow={handleDeleteRow}
        maxHeight={500}
      />
      
      <View style={styles.buttonContainer}>
        <Button 
          title="Save Camera Log" 
          onPress={handleSave} 
          style={styles.button}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 40,
  },
  button: {
    alignSelf: 'center',
    minWidth: 150,
  },
});