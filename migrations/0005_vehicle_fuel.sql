-- Vehicle fuel type (diesel / petrol / hybrid / electric): used to enable/disable inapplicable parts when creating a vehicle.
ALTER TABLE vehicles ADD COLUMN fuel TEXT;
