FROM public.ecr.aws/lambda/nodejs:18

COPY lambda /var/task

CMD ["index.handler"]
