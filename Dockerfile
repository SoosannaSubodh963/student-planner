# Use unprivileged Nginx image (required for OpenShift / Kubernetes non-root security)
FROM nginxinc/nginx-unprivileged:alpine

# Set working directory to Nginx html folder
WORKDIR /usr/share/nginx/html

# Remove default files
RUN rm -rf ./*

# Copy static website files
COPY . .

# Expose unprivileged port 8080 (standard for OpenShift)
EXPOSE 8080

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
