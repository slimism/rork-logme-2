import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button } from '@/components/Button';
import { Table, TableColumn, TableRow } from '@/components/Table';
import { SoundLogData } from '@/types';
import { useProjectStore } from '@/store/projectStore';

interface SoundLogProps {
  logSheetId: string;
  initialData?: SoundLogData;
  onSave?: () => void;
}

interface SoundLogRow {
  id: string;
  scene: string;
  take: string;
  track: string;
  microphone: string;
  recorder: string;
  sampleRate: string;
  bitDepth: string;
  notes: string;
}

export const SoundLog: React.FC<SoundLogProps> = ({ 
  logSheetId, 
  initialData,
  onSave
}) => {
  const { updateLogSheet } = useProjectStore();
  
  const [rows, setRows] = useState<SoundLogRow[]>(() => {
    if (initialData && (initialData as any).rows) {
      return (initialData as any).rows;
    }
    return [
      {
        id: '1',
        scene: '',
        take: '',
        track: '',
        microphone: '',
        recorder: '',
        sampleRate: '',
        bitDepth: '',
        notes: '',
      }
    ];
  });

  const columns: TableColumn[] = [
    { key: 'scene', title: 'Scene', width: 80, editable: true },
    { key: 'take', title: 'Take', width: 70, editable: true, type: 'number' },
    { key: 'track', title: 'Track', width: 80, editable: true },
    { key: 'microphone', title: 'Microphone', width: 120, editable: true },
    { key: 'recorder', title: 'Recorder', width: 100, editable: true },
    { key: 'sampleRate', title: 'Sample Rate', width: 100, editable: true },
    { key: 'bitDepth', title: 'Bit Depth', width: 90, editable: true },
    { key: 'notes', title: 'Notes', width: 150, editable: true, type: 'multiline' },
  ];

  const handleCellChange = (rowId: string, columnKey: string, value: string) => {
    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, [columnKey]: value } : row
    ));
  };

  const handleAddRow = () => {
    const newRow: SoundLogRow = {
      id: Date.now().toString(),
      scene: '',
      take: '',
      track: '',
      microphone: '',
      recorder: '',
      sampleRate: '',
      bitDepth: '',
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
          title="Save Sound Log" 
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