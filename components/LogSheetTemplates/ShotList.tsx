import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button } from '@/components/Button';
import { Table, TableColumn, TableRow } from '@/components/Table';
import { ShotListData } from '@/types';
import { useProjectStore } from '@/store/projectStore';

interface ShotListProps {
  logSheetId: string;
  initialData?: ShotListData;
  onSave?: () => void;
}

interface ShotListRow {
  id: string;
  scene: string;
  shotNumber: string;
  description: string;
  angle: string;
  framing: string;
  movement: string;
  equipment: string;
  duration: string;
  notes: string;
}

export const ShotList: React.FC<ShotListProps> = ({ 
  logSheetId, 
  initialData,
  onSave
}) => {
  const { updateLogSheet } = useProjectStore();
  
  const [rows, setRows] = useState<ShotListRow[]>(() => {
    if (initialData && (initialData as any).rows) {
      return (initialData as any).rows;
    }
    return [
      {
        id: '1',
        scene: '',
        shotNumber: '',
        description: '',
        angle: '',
        framing: '',
        movement: '',
        equipment: '',
        duration: '',
        notes: '',
      }
    ];
  });

  const columns: TableColumn[] = [
    { key: 'scene', title: 'Scene', width: 80, editable: true },
    { key: 'shotNumber', title: 'Shot #', width: 80, editable: true },
    { key: 'description', title: 'Description', width: 150, editable: true, type: 'multiline' },
    { key: 'angle', title: 'Angle', width: 100, editable: true },
    { key: 'framing', title: 'Framing', width: 100, editable: true },
    { key: 'movement', title: 'Movement', width: 100, editable: true },
    { key: 'equipment', title: 'Equipment', width: 120, editable: true },
    { key: 'duration', title: 'Duration', width: 90, editable: true },
    { key: 'notes', title: 'Notes', width: 150, editable: true, type: 'multiline' },
  ];

  const handleCellChange = (rowId: string, columnKey: string, value: string) => {
    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, [columnKey]: value } : row
    ));
  };

  const handleAddRow = () => {
    const newRow: ShotListRow = {
      id: Date.now().toString(),
      scene: '',
      shotNumber: '',
      description: '',
      angle: '',
      framing: '',
      movement: '',
      equipment: '',
      duration: '',
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
          title="Save Shot List" 
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