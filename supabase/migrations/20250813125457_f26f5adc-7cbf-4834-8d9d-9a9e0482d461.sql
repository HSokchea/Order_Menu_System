-- Create storage policies for menu-images bucket
CREATE POLICY "Restaurant owners can upload menu images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'menu-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Restaurant owners can view menu images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'menu-images');

CREATE POLICY "Restaurant owners can update their menu images" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'menu-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Restaurant owners can delete their menu images" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'menu-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);