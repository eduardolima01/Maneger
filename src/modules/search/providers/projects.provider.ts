import type { SearchProvider, SearchResultItem } from '../types/search.types';
import { getAllProjects } from '@/lib/api/projects';
import { fuzzySearch } from '../services/fuzzyMatch';
import { buildProjectBreadcrumbPath } from '@/Projects/utils/projectBreadcrumb';

export function createProjectsProvider(navigate: (path: string) => void): SearchProvider {
  return {
    category: 'projects',
    label: 'Projetos',
    async search(query) {
      const projects = await getAllProjects();
      const roots = projects.filter((p) => !p.parentProjectId);

      return fuzzySearch(roots, query, ['name']).map(
        ({ item, score }): SearchResultItem => ({
          id: item.id,
          category: 'projects',
          title: item.name,
          icon: '📁',
          matchScore: score,
          onSelect: () => navigate(`/projects/${item.id}`),
        })
      );
    },
  };
}

export function createSubprojectsProvider(navigate: (path: string) => void): SearchProvider {
  return {
    category: 'subprojects',
    label: 'Subprojetos',
    async search(query) {
      const projects = await getAllProjects();
      const subprojects = projects.filter((p) => p.parentProjectId);

      const matches = fuzzySearch(subprojects, query, ['name']);
      return matches.map(({ item, score }): SearchResultItem => {
        const breadcrumb = buildProjectBreadcrumbPath(projects, item.id);
        const parentName = breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2].name : undefined;
        return {
          id: item.id,
          category: 'subprojects',
          title: item.name,
          subtitle: parentName,
          icon: '📂',
          matchScore: score,
          onSelect: () => navigate(`/projects/${item.id}`),
        };
      });
    },
  };
}
