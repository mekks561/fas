import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertTitle, AlertDescription, Button } from './ui/shadcn';
import { AlertCircle } from 'lucide-react';

interface ErrorOverlayProps {
  message: string;
  onRetry: () => void;
}

export const ErrorOverlay: React.FC<ErrorOverlayProps> = React.memo(({ message, onRetry }) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-96 max-w-[90vw]">
        <Alert variant="destructive" className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div className="flex-1">
              <AlertTitle className="text-lg font-semibold">{t('error.title')}</AlertTitle>
              <AlertDescription className="mt-1 text-sm">{message}</AlertDescription>
            </div>
          </div>
          <Button variant="destructive" size="lg" className="w-full" onClick={onRetry}>
            {t('error.restart')}
          </Button>
        </Alert>
      </div>
    </div>
  );
});
