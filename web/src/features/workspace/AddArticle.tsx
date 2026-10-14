// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Ways to add an article, as in app.py: upload files, paste text, or fetch from web addresses.

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PasteForm } from './PasteForm';
import { UploadForm } from './UploadForm';
import { UrlForm } from './UrlForm';

export function AddArticle() {
  return (
    <Tabs defaultValue="upload">
      <TabsList aria-label="How to add an article">
        <TabsTrigger value="upload">Upload</TabsTrigger>
        <TabsTrigger value="paste">Paste</TabsTrigger>
        <TabsTrigger value="url">From URL</TabsTrigger>
      </TabsList>
      <TabsContent value="upload">
        <UploadForm />
      </TabsContent>
      <TabsContent value="paste">
        <PasteForm />
      </TabsContent>
      <TabsContent value="url">
        <UrlForm />
      </TabsContent>
    </Tabs>
  );
}
