-- Drop existing policies and recreate them with correct folder structure
DROP POLICY IF EXISTS "Restaurant owners can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can view menu images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can update their menu images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can delete their menu images" ON storage.objects;

-- Create storage policies for menu-images bucket with correct folder structure
CREATE POLICY "Restaurant owners can upload menu images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'menu-images' 
  AND (storage.foldername(name))[1] IN (
    SELECT restaurants.id::text 
    FROM restaurants 
    WHERE restaurants.owner_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view menu images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'menu-images');

CREATE POLICY "Restaurant owners can update their menu images" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'menu-images' 
  AND (storage.foldername(name))[1] IN (
    SELECT restaurants.id::text 
    FROM restaurants 
    WHERE restaurants.owner_id = auth.uid()
  )
);

CREATE POLICY "Restaurant owners can delete their menu images" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'menu-images' 
  AND (storage.foldername(name))[1] IN (
    SELECT restaurants.id::text 
    FROM restaurants 
    WHERE restaurants.owner_id = auth.uid()
  )
);