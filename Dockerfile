# Use official lightweight Nginx image
FROM nginx:alpine

# Set working directory
WORKDIR /usr/share/nginx/html

# Remove default nginx welcome page
RUN rm -rf ./*

# Copy all static website assets
COPY . .

# Expose standard HTTP port
EXPOSE 80

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]
