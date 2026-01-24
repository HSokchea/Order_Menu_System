import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, X, ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageChange: (url: string | null) => void;
  restaurantId: string;
  disabled?: boolean;
}

const ImageUpload = ({ currentImageUrl, onImageChange, restaurantId, disabled }: ImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${restaurantId}/${Date.now()}.${fileExt}`;

    setUploading(true);

    try {
      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('menu-images')
        .getPublicUrl(fileName);

      onImageChange(data.publicUrl);
      
      toast.success("Image uploaded successfully");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async () => {
    if (currentImageUrl) {
      // Extract file path from URL
      const urlParts = currentImageUrl.split('/');
      const fileName = `${urlParts[urlParts.length - 2]}/${urlParts[urlParts.length - 1]}`;
      
      await supabase.storage
        .from('menu-images')
        .remove([fileName]);
    }
    
    onImageChange(null);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadImage(file);
    }
  };

  return (
    <div className="grid gap-2">
      <Label>Item Image</Label>
      <div className="space-y-3">
        {currentImageUrl ? (
          <div className="relative group">
            <img
              src={currentImageUrl}
              alt="Menu item"
              className="w-full h-32 object-cover rounded-lg border"
            />
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={removeImage}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center bg-muted/20">
            <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No image uploaded</p>
          </div>
        )}
        
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || disabled}
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : currentImageUrl ? 'Change Image' : 'Upload Image'}
          </Button>
          
          {currentImageUrl && (
            <Button
              type="button"
              variant="ghost"
              onClick={removeImage}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default ImageUpload;