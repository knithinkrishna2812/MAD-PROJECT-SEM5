from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import FoodListing
from .serializers import FoodListingSerializer, FoodListingListSerializer

class FoodListingViewSet(viewsets.ModelViewSet):
    """ViewSet for food listings CRUD operations"""
    queryset = FoodListing.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description', 'food_type', 'dietary_tags', 'pickup_location']
    ordering_fields = ['created_at', 'expiry_date']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return FoodListingListSerializer
        return FoodListingSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by status
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by food type
        food_type = self.request.query_params.get('food_type', None)
        if food_type:
            queryset = queryset.filter(food_type=food_type)
        
        # Filter available only
        available_only = self.request.query_params.get('available_only', None)
        if available_only:
            queryset = queryset.filter(status='available', expiry_date__gt=timezone.now())
        
        return queryset
    
    def perform_create(self, serializer):
        # Geocode the pickup location if coordinates not provided
        lat = self.request.data.get('latitude')
        lng = self.request.data.get('longitude')
        
        if not lat or not lng:
            pickup_location = self.request.data.get('pickup_location')
            if pickup_location:
                from geopy.geocoders import Nominatim
                geocoder = Nominatim(user_agent="sharebite_app_nithin_prod")
                
                # 1. Try full search query
                search_query = pickup_location
                if 'chennai' not in pickup_location.lower() and 'tamil nadu' not in pickup_location.lower():
                    search_query = f"{pickup_location}, Chennai"
                try:
                    loc = geocoder.geocode(search_query, timeout=5)
                    if loc:
                        lat, lng = loc.latitude, loc.longitude
                except Exception:
                    pass
                
                # 2. Try removing the first element (e.g. building/street number) if still None
                if not lat or not lng:
                    parts = [p.strip() for p in pickup_location.split(',') if p.strip()]
                    if len(parts) > 1:
                        fallback_query = ", ".join(parts[1:])
                        if 'chennai' not in fallback_query.lower() and 'tamil nadu' not in fallback_query.lower():
                            fallback_query = f"{fallback_query}, Chennai"
                        try:
                            loc = geocoder.geocode(fallback_query, timeout=5)
                            if loc:
                                lat, lng = loc.latitude, loc.longitude
                        except Exception:
                            pass
                
                # 3. Extract area name if matches common localities if still None
                if not lat or not lng:
                    areas = ['anna nagar', 'adyar', 'mylapore', 'nungambakkam', 't. nagar', 't nagar', 'velachery', 'karur', 'chennai']
                    for area in areas:
                        if area in pickup_location.lower():
                            query = f"{area.title()}, Tamil Nadu, India" if area != 'chennai' else "Chennai, Tamil Nadu, India"
                            try:
                                loc = geocoder.geocode(query, timeout=5)
                                if loc:
                                    lat, lng = loc.latitude, loc.longitude
                                    break
                            except Exception:
                                pass
        
        serializer.save(
            provider=self.request.user,
            latitude=lat,
            longitude=lng
        )
    
    @action(detail=False, methods=['get'])
    def my_listings(self, request):
        """Get current user's listings"""
        listings = self.queryset.filter(provider=request.user)
        serializer = self.get_serializer(listings, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_completed(self, request, pk=None):
        """Mark listing as completed"""
        listing = self.get_object()
        if listing.provider != request.user:
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)
        
        listing.status = 'completed'
        listing.save()
        return Response({'status': 'Listing marked as completed'})
