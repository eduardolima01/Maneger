import { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api/templates';
import type { Template, CreateTemplateFieldInput, UpdateTemplateFieldInput } from '@/types/template.types';

export function useTemplates(projectId: string) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await api.getTemplatesByProject(projectId);
    setTemplates(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (name: string, description?: string) => {
    const id = await api.createTemplate({ projectId, name, description });
    await reload();
    return id;
  }, [projectId, reload]);

  const rename = useCallback(async (id: string, name: string, description?: string) => {
    await api.updateTemplate(id, { name, description });
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    const result = await api.deleteTemplate(id);
    await reload();
    return result;
  }, [reload]);

  const addField = useCallback(async (input: CreateTemplateFieldInput) => {
    await api.createTemplateField(input);
    await reload();
  }, [reload]);

  const updateField = useCallback(async (id: string, input: UpdateTemplateFieldInput) => {
    await api.updateTemplateField(id, input);
    await reload();
  }, [reload]);

  const removeField = useCallback(async (id: string) => {
    await api.deleteTemplateField(id);
    await reload();
  }, [reload]);

  const reorderFields = useCallback(async (templateId: string, orderedIds: string[]) => {
    await api.reorderTemplateFields(templateId, orderedIds);
    await reload();
  }, [reload]);

  return { templates, loading, create, rename, remove, addField, updateField, removeField, reorderFields, reload };
}

