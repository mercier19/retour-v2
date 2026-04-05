import { useContext } from 'react';
import { PermissionContext } from '@/contexts/PermissionContext';
import { AppRole } from '@/types/database';

export type PermissionKey =
  | 'page_dashboard' | 'page_add_parcel' | 'page_boxes' | 'page_donner_retours'
  | 'page_stock_control' | 'page_statistics' | 'page_advanced_stats' | 'page_search'
  | 'page_transfer' | 'page_inventory' | 'page_admin_users' | 'page_admin_warehouses'
  | 'page_admin_permissions'
  | 'action_transfer_parcel' | 'action_give_parcels' | 'action_mark_missing'
  | 'action_clear_box' | 'action_export_excel' | 'action_export_pptx'
  | 'action_edit_box' | 'action_plan_inventory' | 'action_execute_inventory';

export const ALL_PERMISSION_KEYS: PermissionKey[] = [
  'page_dashboard', 'page_add_parcel', 'page_boxes', 'page_donner_retours',
  'page_stock_control', 'page_statistics', 'page_advanced_stats', 'page_search',
  'page_transfer', 'page_inventory', 'page_admin_users', 'page_admin_warehouses',
  'page_admin_permissions',
  'action_transfer_parcel', 'action_give_parcels', 'action_mark_missing',
  'action_clear_box', 'action_export_excel', 'action_export_pptx',
  'action_edit_box', 'action_plan_inventory', 'action_execute_inventory',
];

export const PAGE_PERMISSIONS: PermissionKey[] = ALL_PERMISSION_KEYS.filter(k => k.startsWith('page_'));
export const ACTION_PERMISSIONS: PermissionKey[] = ALL_PERMISSION_KEYS.filter(k => k.startsWith('action_'));

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  page_dashboard: 'Tableau de bord',
  page_add_parcel: 'Ajouter colis',
  page_boxes: 'Boxes',
  page_donner_retours: 'Donner retours',
  page_stock_control: 'Contrôle stock',
  page_statistics: 'Statistiques',
  page_advanced_stats: 'Stats avancées',
  page_search: 'Rechercher',
  page_transfer: 'Transférer',
  page_inventory: 'Inventaires',
  page_admin_users: 'Utilisateurs (admin)',
  page_admin_warehouses: 'Dépôts (admin)',
  page_admin_permissions: 'Permissions (admin)',
  action_transfer_parcel: 'Transférer un colis',
  action_give_parcels: 'Donner des colis',
  action_mark_missing: 'Marquer manquant',
  action_clear_box: 'Vider une box',
  action_export_excel: 'Exporter Excel',
  action_export_pptx: 'Exporter PPTX',
  action_edit_box: 'Modifier une box',
  action_plan_inventory: 'Planifier inventaire',
  action_execute_inventory: 'Exécuter inventaire',
};

export const DEFAULT_ROLE_PERMISSIONS: Record<AppRole, Record<PermissionKey, boolean>> = {
  operations: {
    page_dashboard: true, page_add_parcel: true, page_boxes: false, page_donner_retours: true,
    page_stock_control: false, page_statistics: true, page_advanced_stats: false, page_search: true,
    page_transfer: true, page_inventory: false, page_admin_users: false, page_admin_warehouses: false,
    page_admin_permissions: false,
    action_transfer_parcel: true, action_give_parcels: true, action_mark_missing: true,
    action_clear_box: false, action_export_excel: true, action_export_pptx: false,
    action_edit_box: false, action_plan_inventory: false, action_execute_inventory: false,
  },
  chef_agence: {
    page_dashboard: true, page_add_parcel: true, page_boxes: true, page_donner_retours: true,
    page_stock_control: false, page_statistics: true, page_advanced_stats: false, page_search: true,
    page_transfer: true, page_inventory: true, page_admin_users: false, page_admin_warehouses: false,
    page_admin_permissions: false,
    action_transfer_parcel: true, action_give_parcels: true, action_mark_missing: true,
    action_clear_box: true, action_export_excel: true, action_export_pptx: false,
    action_edit_box: true, action_plan_inventory: false, action_execute_inventory: true,
  },
  regional: {
    page_dashboard: true, page_add_parcel: true, page_boxes: true, page_donner_retours: true,
    page_stock_control: true, page_statistics: true, page_advanced_stats: true, page_search: true,
    page_transfer: true, page_inventory: true, page_admin_users: false, page_admin_warehouses: false,
    page_admin_permissions: false,
    action_transfer_parcel: true, action_give_parcels: true, action_mark_missing: true,
    action_clear_box: true, action_export_excel: true, action_export_pptx: true,
    action_edit_box: true, action_plan_inventory: true, action_execute_inventory: true,
  },
  super_admin: {
    page_dashboard: true, page_add_parcel: true, page_boxes: true, page_donner_retours: true,
    page_stock_control: true, page_statistics: true, page_advanced_stats: true, page_search: true,
    page_transfer: true, page_inventory: true, page_admin_users: true, page_admin_warehouses: true,
    page_admin_permissions: true,
    action_transfer_parcel: true, action_give_parcels: true, action_mark_missing: true,
    action_clear_box: true, action_export_excel: true, action_export_pptx: true,
    action_edit_box: true, action_plan_inventory: true, action_execute_inventory: true,
  },
};

export const usePermission = (key: PermissionKey): boolean => {
  const ctx = useContext(PermissionContext);
  if (!ctx) return false;
  const { role, overrides } = ctx;
  if (!role) return false;
  if (role === 'super_admin') return true;
  if (key in overrides) return overrides[key]!;
  return DEFAULT_ROLE_PERMISSIONS[role]?.[key] ?? false;
};

export const usePermissions = () => {
  const ctx = useContext(PermissionContext);
  return ctx;
};
