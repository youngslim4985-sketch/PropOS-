import React, { useState, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Home, TrendingUp } from 'lucide-react';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface Deal {
  id: string;
  title: string;
  address: string;
  price: number;
  score: number;
  status: string;
  lat?: number;
  lng?: number;
  [key: string]: any;
}

interface DealMapProps {
  deals: any[];
}

function MarkerWithInfoWindow({ deal }: { deal: any, [key: string]: any }) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  if (!deal.lat || !deal.lng) return null;

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: deal.lat, lng: deal.lng }}
        onClick={() => setOpen(true)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <Pin 
          background={deal.score > 85 ? "#00e5ff" : "#4285F4"} 
          glyphColor="#fff" 
          borderColor="#000"
        />
      </AdvancedMarker>
      {open && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="p-2 space-y-2 max-w-[200px] text-black">
            <h4 className="font-bold text-sm truncate">{deal.title}</h4>
            <p className="text-[10px] text-gray-500 truncate">{deal.address}</p>
            <div className="flex justify-between items-center pt-1 border-t border-gray-100">
              <span className="text-[10px] font-bold">${deal.price.toLocaleString()}</span>
              <Badge variant="outline" className="text-[8px] h-4">
                {deal.score}% SCORE
              </Badge>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function DealMap({ deals }: DealMapProps) {
  // Filter deals that have coordinates
  const mappedDeals = useMemo(() => deals.filter(d => d.lat && d.lng), [deals]);

  const center = useMemo(() => {
    if (mappedDeals.length > 0) {
      return {
        lat: mappedDeals.reduce((acc, d) => acc + (d.lat || 0), 0) / mappedDeals.length,
        lng: mappedDeals.reduce((acc, d) => acc + (d.lng || 0), 0) / mappedDeals.length
      };
    }
    return { lat: 34.0522, lng: -118.2437 }; // Default to LA
  }, [mappedDeals]);

  if (!hasValidKey) {
    return (
      <div className="terminal-card h-[400px] flex items-center justify-center text-center p-8">
        <div className="max-w-md space-y-4">
          <Badge variant="destructive" className="animate-pulse">MAP_ENGINE_OFFLINE</Badge>
          <h2 className="font-display font-black text-xl uppercase italic">Google Maps API Key Required</h2>
          <p className="text-xs font-mono text-muted uppercase leading-relaxed">
            Integration requires a valid Google Maps Platform API key. 
            Open Settings → Secrets and add <span className="text-accent">GOOGLE_MAPS_PLATFORM_KEY</span>.
          </p>
          <div className="pt-4 border-t border-border mt-4">
            <a 
              href="https://console.cloud.google.com/google/maps-apis/start" 
              target="_blank" 
              className="text-[10px] font-bold text-accent hover:underline uppercase tracking-widest"
            >
              Get API Key from Console →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-card h-[600px] relative overflow-hidden group">
      <div className="absolute top-4 left-4 z-10 space-y-2 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-md p-3 border border-accent/30 rounded-lg shadow-2xl pointer-events-auto">
          <p className="text-[8px] font-bold text-accent uppercase tracking-[0.2em] mb-1">Mapping Layer</p>
          <div className="flex items-center gap-2">
            <Home size={12} className="text-neon-cyan" />
            <span className="text-xs font-mono font-bold">{mappedDeals.length} active deals</span>
          </div>
        </div>
      </div>

      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={center}
          defaultZoom={11}
          mapId="DEAL_FLOW_MAP"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
          colorScheme="DARK"
          gestureHandling="greedy"
          disableDefaultUI={false}
        >
          {mappedDeals.map(deal => (
            <MarkerWithInfoWindow key={deal.id} deal={deal} />
          ))}
        </Map>
      </APIProvider>

      <div className="absolute bottom-4 right-4 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <Badge variant="outline" className="bg-black/80 backdrop-blur-md text-[8px] border-accent/20">
          GOOGLE_MAPS_ENGINE_REV_4
        </Badge>
      </div>
    </div>
  );
}
