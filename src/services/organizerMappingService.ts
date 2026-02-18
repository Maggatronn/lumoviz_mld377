// Use the same API_URL as other API calls
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3003/api';

export interface OrganizerMapping {
  primary_vanid: string;
  preferred_name: string;
  alternate_vanids?: string[];
  name_variations?: string[];
  email?: string;
  phone?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  // Extended fields for person mapping
  person_type?: 'organizer' | 'constituent' | 'leader' | 'pending';
  in_van?: boolean;
  van_sync_status?: 'synced' | 'pending_sync' | 'needs_manual_review' | 'not_in_van';
  source?: string;
  source_id?: string;
  turf?: string;
  team_role?: string;
  chapter?: string;
  merged_from_ids?: string[];
  merge_date?: string;
}

/**
 * Fetch all organizer mappings from BigQuery
 */
export async function getOrganizerMappings(): Promise<OrganizerMapping[]> {
  const response = await fetch(`${API_URL}/organizer-mapping`);
  if (!response.ok) {
    throw new Error('Failed to fetch organizer mappings');
  }
  return response.json();
}

/**
 * Save or update an organizer mapping
 */
export async function saveOrganizerMapping(mapping: OrganizerMapping): Promise<void> {
  const response = await fetch(`${API_URL}/organizer-mapping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapping)
  });
  if (!response.ok) {
    throw new Error('Failed to save organizer mapping');
  }
}

/**
 * Delete an organizer mapping
 */
export async function deleteOrganizerMapping(primaryVanid: string): Promise<void> {
  const response = await fetch(`${API_URL}/organizer-mapping/${primaryVanid}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    throw new Error('Failed to delete organizer mapping');
  }
}

/**
 * Resolve any name or ID to the canonical organizer
 * Returns null if no mapping exists
 */
export function resolveOrganizer(
  nameOrId: string, 
  mappings: OrganizerMapping[]
): OrganizerMapping | null {
  const searchTerm = nameOrId.toLowerCase().trim();
  
  for (const mapping of mappings) {
    // Check primary VAN ID
    if (mapping.primary_vanid === searchTerm) {
      return mapping;
    }
    
    // Check alternate VAN IDs
    if (mapping.alternate_vanids?.some(id => id.toLowerCase() === searchTerm)) {
      return mapping;
    }
    
    // Check preferred name
    if (mapping.preferred_name.toLowerCase() === searchTerm) {
      return mapping;
    }
    
    // Check name variations
    if (mapping.name_variations?.some(name => name.toLowerCase() === searchTerm)) {
      return mapping;
    }
  }
  
  return null;
}

/**
 * Resolve an organizer name/ID to its canonical form
 * Returns the preferred name if found in mappings, otherwise returns original
 */
export function getCanonicalOrganizerName(nameOrId: string, mappings: OrganizerMapping[]): string {
  if (!nameOrId) return nameOrId;
  const resolved = resolveOrganizer(nameOrId, mappings);
  return resolved ? resolved.preferred_name : nameOrId;
}

/**
 * Resolve an organizer name/ID to its canonical VAN ID
 * Returns the primary VAN ID if found in mappings, otherwise returns undefined
 */
export function getCanonicalOrganizerVanId(nameOrId: string, mappings: OrganizerMapping[]): string | undefined {
  if (!nameOrId) return undefined;
  const resolved = resolveOrganizer(nameOrId, mappings);
  return resolved ? resolved.primary_vanid : undefined;
}

/**
 * Add a name/ID variation to an existing organizer mapping
 * If the organizer doesn't exist in mappings yet, create them first
 */
export async function addOrganizerVariation(
  primaryVanid: string,
  newNameOrId: string,
  isVanId: boolean,
  mappings: OrganizerMapping[],
  preferredName?: string
): Promise<void> {
  console.log('[addOrganizerVariation] Called with:', { primaryVanid, newNameOrId, isVanId, preferredName, mappingsCount: mappings.length });
  
  let existingMapping = mappings.find(m => m.primary_vanid === primaryVanid);
  
  // If organizer doesn't exist in mappings yet, create them
  if (!existingMapping) {
    console.log('[addOrganizerVariation] Organizer not found in mappings, creating new entry');
    
    const newMapping: OrganizerMapping = {
      primary_vanid: String(primaryVanid), // Ensure string
      preferred_name: preferredName || String(primaryVanid),
      alternate_vanids: isVanId ? [String(newNameOrId)] : [],
      name_variations: isVanId ? [] : [String(newNameOrId)],
      notes: `Automatically created when mapping ${newNameOrId}`
    };
    
    console.log('[addOrganizerVariation] Saving new mapping:', newMapping);
    await saveOrganizerMapping(newMapping);
    console.log('[addOrganizerVariation] New mapping created successfully');
    return;
  }
  
  // Otherwise update existing mapping
  console.log('[addOrganizerVariation] Found existing mapping, updating:', existingMapping.preferred_name);
  
  const updatedMapping = { ...existingMapping };
  
  if (isVanId) {
    // Add to alternate_vanids if not already there
    if (!updatedMapping.alternate_vanids?.includes(String(newNameOrId))) {
      updatedMapping.alternate_vanids = [
        ...(updatedMapping.alternate_vanids || []),
        String(newNameOrId)
      ];
      console.log('[addOrganizerVariation] Added VAN ID variation:', newNameOrId);
    } else {
      console.log('[addOrganizerVariation] VAN ID already exists, skipping');
    }
  } else {
    // Add to name_variations if not already there
    if (!updatedMapping.name_variations?.includes(String(newNameOrId))) {
      updatedMapping.name_variations = [
        ...(updatedMapping.name_variations || []),
        String(newNameOrId)
      ];
      console.log('[addOrganizerVariation] Added name variation:', newNameOrId);
    } else {
      console.log('[addOrganizerVariation] Name already exists, skipping');
    }
  }
  
  console.log('[addOrganizerVariation] Saving updated mapping:', updatedMapping);
  await saveOrganizerMapping(updatedMapping);
  console.log('[addOrganizerVariation] Mapping updated successfully');
}

/**
 * Merge two people into one
 * The merge person will be deleted and all references updated to primary
 */
export async function mergePeople(
  primaryVanid: string,
  mergeVanid: string,
  allMappings: OrganizerMapping[]
): Promise<void> {
  console.log('[mergePeople] Merging', mergeVanid, 'into', primaryVanid);
  
  const primary = allMappings.find(m => m.primary_vanid === primaryVanid);
  const toMerge = allMappings.find(m => m.primary_vanid === mergeVanid);
  
  if (!primary || !toMerge) {
    throw new Error('One or both people not found in mappings');
  }
  
  // Merge the data
  const mergedAlternateVanids = [
    ...(primary.alternate_vanids || []),
    mergeVanid,
    ...(toMerge.alternate_vanids || [])
  ];
  
  const mergedNameVariations = [
    ...(primary.name_variations || []),
    toMerge.preferred_name,
    ...(toMerge.name_variations || [])
  ];
  
  const mergedFromIds = [
    ...(primary.merged_from_ids || []),
    mergeVanid
  ];
  
  // Update primary record
  const updatedPrimary: OrganizerMapping = {
    ...primary,
    alternate_vanids: mergedAlternateVanids,
    name_variations: mergedNameVariations,
    merged_from_ids: mergedFromIds,
    merge_date: new Date().toISOString(),
    notes: `${primary.notes || ''}\nMerged ${mergeVanid} on ${new Date().toLocaleDateString()}`.trim()
  };
  
  await saveOrganizerMapping(updatedPrimary);
  await deleteOrganizerMapping(mergeVanid);
  
  console.log('[mergePeople] Merge completed successfully');
}

/**
 * Create a pending person (not in VAN yet)
 * Returns the temporary ID
 */
export async function createPendingPerson(data: {
  name: string;
  email?: string;
  phone?: string;
  personType: 'constituent' | 'leader';
  source: string;
  sourceId?: string;
}): Promise<string> {
  // Generate temporary ID
  const tempId = `pending_${Date.now()}`;
  
  const mapping: OrganizerMapping = {
    primary_vanid: tempId,
    preferred_name: data.name,
    person_type: data.personType,
    email: data.email,
    phone: data.phone,
    in_van: false,
    van_sync_status: 'pending_sync',
    source: data.source,
    source_id: data.sourceId,
    notes: `Created from ${data.source} on ${new Date().toLocaleDateString()}`
  };
  
  await saveOrganizerMapping(mapping);
  console.log('[createPendingPerson] Created pending person:', tempId);
  return tempId;
}
