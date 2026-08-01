import type { SearchProvider } from '../types/search.types';

class SearchRegistry {
  private providers: SearchProvider[] = [];

  register(provider: SearchProvider): void {
    this.providers.push(provider);
  }

  list(): SearchProvider[] {
    return this.providers;
  }
}

export const searchRegistry = new SearchRegistry();

