import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button } from '@/components/Button';
import { Table, TableColumn, TableRow } from '@/components/Table';
import { ContinuityLogData } from '@/types';
import { useProjectStore } from '@/store/projectStore';

interface ContinuityLogProps {
  logSheetId: string;
  initialData?: ContinuityLogData;
  onSave?: () => void;
}

interface ContinuityLogRow {
  id: string;
  scene: string;
  take: string;
  description: string;
  wardrobe: string;
  props: string;
  makeup: string;
  hair: string;
  notes: string;
}

export const ContinuityLog: React.FC<ContinuityLogProps> = ({ 
  logSheetId, 
  initialData,
  onSave
}) => {
  const { updateLogSheet } = useProjectStore();
  
  const [rows, setRows] = useState<ContinuityLogRow[]>(() => {
    if (initialData && (initialData as any).rows) {
      return (initialData as any).rows;
    }
    return [
      {
        id: '1',
        scene: '',
        take: '',
        description: '',
        wardrobe: '',
        props: '',
        makeup: '',
        hair: '',
        notes: '',
      }
    ];
  });

  const columns: TableColumn[] = [
    { key: 'scene', title: 'Scene', width: 80, editable: true },
    { key: 'take', title: 'Take', width: 70, editable: true, type: 'number' },
    { key: 'description', title: 'Description', width: 150, editable: true, type: 'multiline' },
    { key: 'wardrobe', title: 'Wardrobe', width: 120, editable: true, type: 'multiline' },
    { key: 'props', title: 'Props', width: 120, editable: true, type: 'multiline' },
    { key: 'makeup', title: 'Makeup', width: 120, editable: true, type: 'multiline' },
    { key: 'hair', title: 'Hair', width: 120, editable: true, type: 'multiline' },
    { key: 'notes', title: 'Notes', width: 150, editable: true, type: 'multiline' },
  ];

  const handleCellChange = (rowId: string, columnKey: string, value: string) => {
    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, [columnKey]: value } : row
    ));
  };

  const handleAddRow = () => {
    const newRow: ContinuityLogRow = {
      id: Date.now().toString(),
      scene: '',
      take: '',
      description: '',
      wardrobe: '',
      props: '',
      makeup: '',
      hair: '',
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
          title="Save Continuity Log" 
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