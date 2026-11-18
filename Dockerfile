# Use unprivileged Nginx image designed for OpenShift and Kubernetes
FROM nginxinc/nginx-unprivileged:alpine

# Copy custom Nginx configuration with OpenShift non-root /tmp paths
COPY nginx.conf /etc/nginx/nginx.conf

# Set working directory to standard Nginx document root
WORKDIR /usr/share/nginx/html

# Clean default html assets
RUN rm -rf ./*

# Copy all application files into document root
COPY . .

# Remove configuration and repo files from public document root
RUN rm -f nginx.conf Dockerfile docker-compose.yml README.md

# Expose unprivileged port 8080 (standard OpenShift HTTP port)
EXPOSE 8080

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
